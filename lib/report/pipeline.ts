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
import type { LlmProvider } from "./generate";
import { ClaudeLlmProvider } from "./generate";
import { GeminiLlmProvider, FallbackLlmProvider } from "./gemini";
import { DemoLlmProvider } from "./demo";
import { renderReportHtml } from "./html";
import type { SajuResult } from "../saju";

/**
 * 사용 가능한 API 키에 따라 LLM 공급자를 결정한다.
 *   - Gemini·Claude 둘 다 → Gemini(무료) 우선, 실패 시 Claude 폴백
 *   - Gemini만 → Gemini
 *   - Claude만 → Claude
 *   - 둘 다 없음 → 데모 목업(로컬 개발)
 */
function resolveProvider(saju: SajuResult): LlmProvider {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;

  if (hasGemini && hasClaude) {
    return new FallbackLlmProvider(new GeminiLlmProvider(), new ClaudeLlmProvider());
  }
  if (hasGemini) return new GeminiLlmProvider();
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
};

/**
 * 자녀 정보로 완성된 리포트(markdown + 디자인 HTML)를 만든다.
 *
 * @throws {GuardrailError} 산문에 금지 표현이 있으면 (발행 차단)
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
  const { markdown, prose } = await generateReport(
    {
      saju,
      schools,
      birthYear: subject.birthYear,
      currentYear,
      currentSchoolName: subject.currentSchool,
      childName: subject.name,
    },
    { llmProvider: provider }
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

  return { markdown, html, isDemo, prose };
}
