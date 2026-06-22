/**
 * lib/report — 유일하게 두 레이어를 import 할 수 있는 곳
 *
 * lib/saju (해석) + lib/schools (사실) → 리포트 생성
 *
 * [절대 규칙]
 * - 학교 사실(학교명·진학률·거리)은 코드(buildFactBlock)가 삽입.
 *   LLM은 관점 산문만 작성하며 학교 사실에 접근하지 않는다.
 * - guardrails 검사를 통과하지 못하면 발행이 차단된다.
 *
 * 파이프라인:
 * 1. 사실 블록 생성 (코드, LLM 없음)
 * 2. LLM 관점 블록 생성 (사주 데이터만 전달, 학교 사실 미전달)
 * 3. guardrails 검사 → 금지 표현 발견 시 GuardrailError throw
 * 4. 사실 블록 + 관점 블록 조립
 */

import type { SajuResult } from "../saju";
import type { SchoolFacts } from "../schools";
import { buildFactBlock, assembleReport } from "./template";
import { generatePerspective, ClaudeLlmProvider } from "./generate";
import type { LlmProvider } from "./generate";
import { checkGuardrails } from "./guardrails";

export { GuardrailError } from "./guardrails";
export type { GuardrailViolation } from "./guardrails";
export type { LlmProvider, LlmPerspective } from "./generate";
export type { FactBlock, PerspectiveBlock } from "./template";
export {
  buildFactBlock,
  assembleReport,
  buildSajuTableSection,
  buildElementsSection,
  buildTenGodsSection,
  buildTraitsSection,
  buildDaeunSection,
  buildCareerMapSection,
  buildMajorMapSection,
  TIME_STANDARD_NOTICE,
  DST_CORRECTION_NOTICE,
  INTERPRETATION_NOTICE,
  ASSIGNED_SCHOOL_LABEL,
} from "./template";
export { checkGuardrails, passesGuardrails } from "./guardrails";
export { renderReportHtml } from "./html";
export type { RenderHtmlOptions } from "./html";
export { buildReportForSubject } from "./pipeline";
export type { BuildReportSubject, BuildReportOptions, BuiltReport } from "./pipeline";
export { DemoLlmProvider, buildDemoProse } from "./demo";

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export type ReportInput = {
  saju: SajuResult;
  /** Premium: 학교 사실 포함 */
  schools?: SchoolFacts;
  tier: "basic" | "premium";
  /** 학령 단계·세운 나이 산출용 출생 연도 */
  birthYear?: number;
  /** 기준 연도 (기본: 현재 연도 — 테스트·샘플 고정용) */
  currentYear?: number;
  /** 현재 재학 기관명 (보호자 입력 사실 — 코드 표기, LLM 미전달) */
  currentSchoolName?: string;
};

export type ReportOutput = {
  /** 최종 마크다운 리포트 */
  markdown: string;
  tier: "basic" | "premium";
};

export type GenerateReportOptions = {
  /**
   * LLM 공급자 주입 (기본: ClaudeLlmProvider).
   * 테스트에서 MockLlmProvider로 교체해 API 없이 테스트 가능.
   */
  llmProvider?: LlmProvider;
};

// ──────────────────────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────────────────────

/**
 * 리포트를 생성한다.
 *
 * Basic tier: 사주 해석 산문만.
 * Premium tier: + 예상 배정 학교 + 학교군 사실 블록 + 기질-학교 연결 관점.
 *
 * @throws {GuardrailError} LLM 출력에 금지 표현이 발견되면
 * @throws {Error} LLM 응답이 올바른 JSON이 아니면
 */
export async function generateReport(
  input: ReportInput,
  options: GenerateReportOptions = {}
): Promise<ReportOutput> {
  const { saju, schools, tier, birthYear, currentYear, currentSchoolName } = input;
  const provider = options.llmProvider ?? new ClaudeLlmProvider();
  const meta = { birthYear, currentYear, currentSchoolName };

  // 1. 사실 블록 생성 — 코드만, LLM 없음
  //    Premium + 학교 데이터 있을 때만 사실 블록 포함
  const factBlock =
    tier === "premium" && schools ? buildFactBlock(schools, saju) : {};

  // 2. LLM 관점 블록 생성
  //    buildUserPrompt() 는 학교명·주소·진학률을 LLM에게 전달하지 않는다
  const perspective = await generatePerspective(saju, tier, provider, meta);

  // 3. guardrails 검사 — 모든 산문 필드, 위반 시 GuardrailError throw → 발행 차단
  for (const prose of Object.values(perspective)) {
    if (typeof prose === "string") checkGuardrails(prose);
  }

  // 4. 조립 (사주 데이터 섹션·도식·정적 콘텐츠는 코드가 생성)
  const markdown = assembleReport(saju, factBlock, perspective, meta);

  return { markdown, tier };
}
