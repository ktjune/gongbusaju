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
import { getSchoolFacts } from "../schools";
import type { SchoolFixture, ZoneCollection } from "../schools";
import { generateReport } from "./index";
import type { LlmProvider } from "./generate";
import { ClaudeLlmProvider } from "./generate";
import { DemoLlmProvider } from "./demo";
import { renderReportHtml } from "./html";

export type BuildReportSubject = {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender: "male" | "female";
  address?: string;
  currentSchool?: string;
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
  tier: "basic" | "premium";
  /** LLM 미연동(데모 목업)으로 생성됐는지 */
  isDemo: boolean;
};

/**
 * 자녀 정보로 완성된 리포트(markdown + 디자인 HTML)를 만든다.
 *
 * @throws {GuardrailError} 산문에 금지 표현이 있으면 (발행 차단)
 */
export async function buildReportForSubject(
  subject: BuildReportSubject,
  tier: "basic" | "premium",
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

  // 2. 학교 사실 (Premium + 주소) — 사실 레이어. 사주를 입력으로 받지 않는다.
  let schools;
  if (tier === "premium" && subject.address) {
    schools = await getSchoolFacts(subject.address, {
      fixtureSchools: opts.fixtureSchools,
      fixtureZones: opts.fixtureZones,
    });
  }

  // 3. LLM provider 결정 — 키 있으면 Claude, 없으면 데모 목업
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const provider =
    opts.llmProvider ?? (hasKey ? new ClaudeLlmProvider() : new DemoLlmProvider(saju));
  const isDemo = !opts.llmProvider && !hasKey;

  // 4. 리포트 생성 (관점 산문 + 사실 블록 합성 + guardrails)
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  const { markdown } = await generateReport(
    {
      saju,
      schools,
      tier,
      birthYear: subject.birthYear,
      currentYear,
      currentSchoolName: subject.currentSchool,
    },
    { llmProvider: provider }
  );

  // 5. 디자인 HTML 렌더
  const html = renderReportHtml(saju, markdown, {
    tier,
    subjectLabel: opts.subjectLabel,
    generatedAt: new Date().toISOString().slice(0, 10),
    sampleNotice: isDemo
      ? "데모 자동 생성 — 실제 서비스는 전문 해석가가 검수합니다"
      : undefined,
  });

  return { markdown, html, tier, isDemo };
}
