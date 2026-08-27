/**
 * lib/report/pipeline.ts
 * 생성 오케스트레이션 — 자녀 정보 → 사주 계산 + 학교 조회 + 리포트 + 렌더.
 *
 * lib/report는 두 레이어(saju·schools)를 합치는 유일한 곳이다(SPEC §4).
 * 이 모듈이 그 합류 지점으로, 다음을 한 번에 수행한다:
 *   computeSaju → (Premium) getSchoolFacts → generateReport → renderReportHtml
 *
 * orders 레이어는 이 함수만 호출하면 되고 saju·schools를 직접 import하지 않는다.
 */

import { computeSaju } from "../saju";
import type { SchoolFixture, ZoneCollection } from "../schools";
import { getSchoolFacts } from "../schools";
import { generateReport } from "./index";
import type { GuardrailViolation } from "./guardrails";
import type { LlmProvider } from "./generate";
import { ClaudeLlmProvider } from "./generate";
import { GeminiLlmProvider, FallbackLlmProvider } from "./gemini";
import { DemoLlmProvider } from "./demo";
import { renderReportHtml } from "./html";
import type { SajuResult } from "../saju";

/**
 * 사용 가능한 API 키에 따라 LLM 공급자를 결정한다.
 *
 *   - Gemini 있음 → Gemini(GEMINI_MODEL). GEMINI_FALLBACK_MODEL이 설정돼 있으면
 *     실패 시 그 모델로 자동 전환한다.
 *   - Gemini 없고 Claude만 → Claude
 *   - 둘 다 없음 → 데모 목업(로컬 개발)
 *
 * **왜 Claude를 Gemini의 폴백으로 쓰지 않는가** (2026-08-27 변경)
 *
 * 예전에는 둘 다 있으면 Gemini→Claude로 넘겼다. 그런데 Anthropic 크레딧이
 * 소진되자 폴백이 조용히 죽었고, Gemini가 잘 도는 동안에는 그 사실을 알 방법이
 * 없었다. **죽은 폴백은 폴백이 없는 것보다 나쁘다** — 있다고 착각하게 만든다.
 *
 * 실제로 가장 자주 겪을 실패는 공급자 전면 장애가 아니라 **레이트리밋**이다.
 * 리포트 1건이 5개 그룹을 동시에 호출하므로(generate.ts의 Promise.all),
 * 주문이 몇 건만 겹쳐도 순간 요청이 수십 개가 된다. 모델별로 할당량이 따로라
 * **같은 키의 다른 모델로 넘기는 것만으로 이 구간이 커버된다.** 비용도 0이고
 * 관리할 키도 늘지 않는다.
 *
 * 공급자 전면 장애는 이 폴백으로 못 막지만, 그건 worker 크론의 재시도(최대 6회)
 * 영역이다. 주문은 사라지지 않고 늦어질 뿐이며 소진 시 운영자에게 알림이 간다.
 *
 * 폴백 모델명은 env로 둔다 — 모델 목록은 자주 바뀌므로 코드에 박으면
 * 존재하지 않는 모델로 조용히 실패한다. 미설정이면 폴백 없이 단일 모델로 돈다.
 * 설정한 모델이 실제로 유효한지는 /api/admin/llm-health에서 확인할 수 있다.
 */
function resolveProvider(saju: SajuResult): LlmProvider {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;

  if (hasGemini) {
    const primary = new GeminiLlmProvider();
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();
    if (!fallbackModel) return primary;
    return new FallbackLlmProvider(
      primary,
      new GeminiLlmProvider(undefined, fallbackModel)
    );
  }
  if (hasClaude) return new ClaudeLlmProvider();
  return new DemoLlmProvider(saju);
}

export type BuildReportSubject = {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender: "male" | "female";
  address?: string;
  currentSchool?: string;
  /** 아이 이름(한글, 선택) — 표지·요약 호명용. LLM 미전송. */
  name?: string;
  /** 아이 이름 한자(선택) — 자원오행 분석용. LLM 미전송. */
  nameHanja?: string;
};

export type BuildReportOptions = {
  /** LLM 주입. 미지정 시 ANTHROPIC_API_KEY 있으면 Claude, 없으면 데모 목업 */
  llmProvider?: LlmProvider;
  /** 학교 픽스처(개발/데모). DATABASE_URL 없을 때 사용 */
  fixtureSchools?: SchoolFixture[];
  fixtureZones?: ZoneCollection;
  /** 기준 연도 (학령 단계·세운) — 기본 현재 */
  currentYear?: number;
  /** 결과페이지 표지 라벨 */
  subjectLabel?: string;
};

export type BuiltReport = {
  markdown: string;
  html: string;
  /** LLM 미연동(데모 목업)으로 생성됐는지 */
  isDemo: boolean;
  /** LLM 생성 산문만 이어 붙인 것 — 자동 QA 검수 대상 */
  prose: string;
  /** 감지된 금지 표현(가드레일). 비어있지 않으면 자동 발행 금지 → 재생성·사람 검수. */
  guardrailViolations: GuardrailViolation[];
};

/**
 * 자녀 정보로 완성된 리포트(markdown + 디자인 HTML)를 만든다.
 *
 * 금지 표현은 throw하지 않고 guardrailViolations로 반환한다(유료 주문 유실 방지).
 * 호출자(orders)가 재생성·사람 검수로 라우팅한다.
 */
export async function buildReportForSubject(
  subject: BuildReportSubject,
  opts: BuildReportOptions = {}
): Promise<BuiltReport> {
  // 1. 사주 계산 (해석 레이어)
  const saju = computeSaju({
    birthYear: subject.birthYear,
    birthMonth: subject.birthMonth,
    birthDay: subject.birthDay,
    birthHour: subject.birthHour,
    birthMinute: subject.birthMinute,
    gender: subject.gender,
  });

  // 2. LLM provider 결정 — 우선순위:
  //    ① 주입된 provider(테스트) → ② Gemini+Claude 폴백 → ③ Gemini만
  //    → ④ Claude만 → ⑤ 데모 목업(키 없음)
  const provider = opts.llmProvider ?? resolveProvider(saju);
  const isDemo =
    !opts.llmProvider &&
    !process.env.GEMINI_API_KEY &&
    !process.env.ANTHROPIC_API_KEY;

  // 3. 학교 사실 조회 (주소가 있을 때만)
  const schools = subject.address
    ? await getSchoolFacts(subject.address, {
        fixtureSchools: opts.fixtureSchools,
        fixtureZones: opts.fixtureZones,
      }).catch(() => undefined)
    : undefined;

  // 4. 리포트 생성 (관점 산문 + guardrails)
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  const { markdown, prose, guardrailViolations } = await generateReport(
    {
      saju,
      schools,
      birthYear: subject.birthYear,
      currentYear,
      currentSchoolName: subject.currentSchool,
      childName: subject.name,
      childNameHanja: subject.nameHanja,
    },
    { llmProvider: provider, guardrailMode: "collect" }
  );

  // 4. 디자인 HTML 렌더
  const html = renderReportHtml(saju, markdown, {
    subjectLabel: opts.subjectLabel,
    childName: subject.name,
    generatedAt: new Date().toISOString().slice(0, 10),
    sampleNotice: isDemo
      ? "데모 자동 생성 — 실제 서비스는 전문 해석가가 검수합니다"
      : undefined,
  });

  return { markdown, html, isDemo, prose, guardrailViolations };
}
