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
export { ClaudeLlmProvider } from "./generate";
import type { LlmProvider } from "./generate";
import { checkGuardrails, GuardrailError } from "./guardrails";
import type { GuardrailViolation } from "./guardrails";

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
export { GeminiLlmProvider, FallbackLlmProvider } from "./gemini";
export { runReportQa, runStructuralQa, runLlmQaReview, runAutoQa } from "./qa";
export type { QaResult } from "./qa";

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export type ReportInput = {
  saju: SajuResult;
  /** 학교 사실 (주소→지오코딩→DB 조회 결과). LLM에는 전달하지 않고 코드가 삽입 */
  schools?: SchoolFacts;
  /** 학령 단계·세운 나이 산출용 출생 연도 */
  birthYear?: number;
  /** 기준 연도 (기본: 현재 연도 — 테스트·샘플 고정용) */
  currentYear?: number;
  /** 현재 재학 기관명 (보호자 입력 사실 — 코드 표기, LLM 미전달) */
  currentSchoolName?: string;
  /** 아이 이름(한글, 선택) — 요약 호명용. 코드 표기, LLM 미전달. */
  childName?: string;
  /** 아이 이름 한자(선택) — 자원오행 분석용. 코드 표기, LLM 미전달. */
  childNameHanja?: string;
};

export type ReportOutput = {
  /** 최종 마크다운 리포트 */
  markdown: string;
  /** LLM이 생성한 관점 산문만 이어 붙인 것 — 자동 QA 검수 대상(코드 생성물 제외) */
  prose: string;
  /** 감지된 금지 표현(가드레일) 목록. guardrailMode="collect"에서 채워진다. 비면 통과. */
  guardrailViolations: GuardrailViolation[];
};

export type GenerateReportOptions = {
  /**
   * LLM 공급자 주입 (기본: ClaudeLlmProvider).
   * 테스트에서 MockLlmProvider로 교체해 API 없이 테스트 가능.
   */
  llmProvider?: LlmProvider;
  /**
   * 가드레일 위반 처리 방식.
   *   "throw"(기본): 금지 표현 발견 시 GuardrailError throw (발행 즉시 차단).
   *   "collect": 던지지 않고 위반 목록만 반환 → 호출자가 재생성·사람 검수로 라우팅.
   */
  guardrailMode?: "throw" | "collect";
};

// ──────────────────────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────────────────────

/**
 * LLM 산문의 흔한 기계적 오류를 가볍게 보정한다 (내용은 건드리지 않음).
 * - 문장부호(. ! ?) 뒤에 공백 없이 한글/여는따옴표가 붙은 경우 공백 삽입
 *   ("느낄 것입니다.다만" → "느낄 것입니다. 다만"). 소수점(3.5)은 뒤가 숫자라 영향 없음.
 * - 중복 공백 정리.
 */
function tidyProse(s: string): string {
  return s
    // 문장부호 뒤 공백 없이 다음 문장이 붙은 경우 공백 삽입.
    // 곧은 따옴표(" ')는 닫는 용도로도 쓰여(…이네!') 오탐하므로 제외 — 명확히 여는 기호만.
    .replace(/([.!?])([가-힣“‘(《「])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ");
}

/**
 * 가드레일이 권장하는 완화형으로 자동 치환한다 (스타일 단정 → "경향" 표현).
 * 표시광고법 위험 표현(보장·무조건·틀림없이·학교 인과 등)은 여기서 손대지 않고
 * 재생성·사람 검수로 보낸다 — 뜻이 바뀔 수 있어 자동 치환하지 않는다.
 */
function softenAssertions(s: string): string {
  return s.replace(/적합합니다/g, "잘 맞는 경향이 있습니다");
}

/**
 * 리포트를 생성한다.
 *
 * @throws {GuardrailError} LLM 출력에 금지 표현이 발견되면
 * @throws {Error} LLM 응답이 올바른 JSON이 아니면
 */
export async function generateReport(
  input: ReportInput,
  options: GenerateReportOptions = {}
): Promise<ReportOutput> {
  const { saju, schools, birthYear, currentYear, currentSchoolName, childName, childNameHanja } = input;
  const provider = options.llmProvider ?? new ClaudeLlmProvider();
  // LLM에 넘기는 meta에는 이름을 포함하지 않는다 (식별정보 미전송 원칙).
  const llmMeta = { birthYear, currentYear, currentSchoolName };

  // 1. 사실 블록 생성 (코드, LLM 없음) — 학교명·거리·출처는 여기서만 삽입
  const factBlock = schools ? buildFactBlock(schools) : {};

  // 2. LLM 관점 블록 생성 — 학교 사실·이름은 전달하지 않는다
  const perspectiveRaw = await generatePerspective(saju, provider, llmMeta);

  // 2.5 흔한 기계적 오류 자동 보정 (문장부호 뒤 공백 누락 등) — 품질↑, QA 오탐↓
  const perspective = Object.fromEntries(
    Object.entries(perspectiveRaw).map(([k, v]) => [
      k,
      typeof v === "string" ? softenAssertions(tidyProse(v)) : v,
    ])
  ) as typeof perspectiveRaw;

  // 3. guardrails 검사 — 각 산문의 금지 표현을 모두 수집
  const guardrailViolations: GuardrailViolation[] = [];
  for (const prose of Object.values(perspective)) {
    if (typeof prose !== "string") continue;
    try {
      checkGuardrails(prose);
    } catch (e) {
      if (e instanceof GuardrailError) guardrailViolations.push(...e.violations);
      else throw e;
    }
  }
  // 기본은 즉시 차단(throw). "collect" 모드는 던지지 않고 위반을 반환해
  // 호출자가 재생성·사람 검수로 라우팅하게 한다 (유료 주문을 잃지 않도록).
  if ((options.guardrailMode ?? "throw") === "throw" && guardrailViolations.length > 0) {
    throw new GuardrailError(guardrailViolations);
  }

  // 4. 조립 — 이름은 코드가 넣는 조립 단계에서만 사용
  const markdown = assembleReport(saju, factBlock, perspective, {
    ...llmMeta,
    childName,
    childNameHanja,
  });

  // LLM 산문만 이어 붙임 — 자동 QA는 이것만 검수(코드 생성 표·칩·도식 제외)
  const prose = Object.values(perspective)
    .filter((v): v is string => typeof v === "string")
    .join("\n\n");

  return { markdown, prose, guardrailViolations };
}
