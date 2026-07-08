/**
 * lib/report/qa.ts
 * LLM 생성 리포트 자동 QA — 어드민 승인 전 1차 점검.
 *
 * 구조 검사(분량·금지표현)를 먼저 돌리고, 통과한 경우에만
 * LLM 재검토(오타·문맥 어색함·반복 면책문구)를 호출한다 (비용 절약).
 * 통과하면 자동 승인 후보, 실패하면 사람 검수(어드민 "검수 큐")로 넘어간다.
 */

import { ClaudeLlmProvider } from "./generate";
import type { LlmProvider } from "./generate";
import { GeminiLlmProvider, FallbackLlmProvider } from "./gemini";

/** 자동 QA용 LLM 공급자 — Gemini 우선, Claude 폴백. 키 없으면 null(구조 검사만). */
function resolveQaProvider(): LlmProvider | null {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  if (hasGemini && hasClaude) {
    return new FallbackLlmProvider(new GeminiLlmProvider(), new ClaudeLlmProvider());
  }
  if (hasGemini) return new GeminiLlmProvider();
  if (hasClaude) return new ClaudeLlmProvider();
  return null;
}


export type QaResult = {
  passed: boolean;
  issues: string[];
};

/** 15개 산문 합산 최소 분량(자) — 비정상적으로 짧으면 누락·잘림 의심 */
const MIN_MARKDOWN_LENGTH = 2000;

/**
 * 구조 검사 — 분량만 (LLM 호출 없음).
 *
 * 금지표현(guardrails)은 생성 단계(generateReport)에서 LLM 산문에 이미 검사되어
 * 위반 시 생성 자체가 실패한다. 따라서 여기서 전체 마크다운에 다시 돌리면
 * 코드가 넣는 면책 문구("…보장하지 않습니다")까지 오탐으로 잡히므로 하지 않는다.
 */
export function runStructuralQa(markdown: string): string[] {
  const issues: string[] = [];
  const trimmed = markdown.trim();

  if (trimmed.length < MIN_MARKDOWN_LENGTH) {
    issues.push(`리포트 분량이 비정상적으로 짧습니다 (${trimmed.length}자)`);
  }

  return issues;
}

/** LLM 재검토 — 오타·문맥 어색함·반복 면책문구. 해석 방향(사주 풀이 자체)은 평가하지 않는다. */
export async function runLlmQaReview(
  markdown: string,
  provider: LlmProvider
): Promise<string[]> {
  const systemPrompt = `당신은 공부사주 리포트의 품질 검수자입니다.
아래 리포트 본문을 읽고 다음 기준으로만 점검합니다:
1. 오타·맞춤법 오류 (명백한 것만)
2. 문맥이 어색하거나 앞뒤 문장이 서로 모순되는 부분
3. 문단·문장이 중간에 끊기거나 미완성으로 보이는지 (예: 문장이 갑자기 끝남)

내용의 해석 방향(사주 풀이 자체가 맞는지)은 평가하지 않습니다. 형식적 결함만 찾습니다.
**명백하고 실질적인 결함만 지적하세요.** 사소한 문체 취향, 면책 문구의 반복 여부, 표·기호·숫자 나열은 문제가 아닙니다.
문제가 없으면 issues를 빈 배열([])로 둡니다. 반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 않습니다:
{"issues": ["문제 설명1", "문제 설명2"]}`;

  const schema = {
    type: "object",
    properties: { issues: { type: "array", items: { type: "string" } } },
    required: ["issues"],
    additionalProperties: false,
  };

  const raw = await provider.complete(systemPrompt, markdown, schema);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return [`QA 검토 응답 형식 오류: "${raw.slice(0, 100)}"`];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { issues?: string[] };
    return parsed.issues ?? [];
  } catch {
    return [`QA 검토 응답 JSON 파싱 실패: "${jsonMatch[0].slice(0, 100)}"`];
  }
}

/**
 * 리포트 자동 QA — 구조 검사 후 통과 시에만 LLM 재검토.
 * 구조 검사 실패 시 LLM을 호출하지 않고 즉시 반환한다.
 */
export async function runReportQa(
  markdown: string,
  provider: LlmProvider
): Promise<QaResult> {
  const structuralIssues = runStructuralQa(markdown);
  if (structuralIssues.length > 0) {
    return { passed: false, issues: structuralIssues };
  }

  const llmIssues = await runLlmQaReview(markdown, provider);
  return { passed: llmIssues.length === 0, issues: llmIssues };
}

/**
 * 호출자(주문 생성 오케스트레이션)를 위한 단일 진입점.
 *
 * - ANTHROPIC_API_KEY 없으면(데모 모드) LLM 재검토는 건너뛰고 구조 검사만 수행한다
 *   (데모는 실제 API 호출 없이 통과시켜 로컬 개발을 막지 않는다).
 * - QA 자체가 예외로 죽으면(네트워크 등) throw하지 않고 실패로 간주해
 *   호출자가 안전하게 사람 검수로 폴백할 수 있게 한다.
 */
/**
 * 자동 QA 검수 에이전트 — 어드민 자동 승인 판정.
 *
 * ① 구조 검사(분량) → 실패 시 즉시 사람 검수.
 *    (금지표현·잘림·필드누락은 생성 단계에서 이미 차단됨)
 * ② QA_LLM_REVIEW=1 이면 LLM 품질 검수(오타·문맥·미완성) 추가 — Gemini 우선, Claude 폴백.
 *    · 기본 OFF: Vercel Hobby 60초 함수 한계 때문. 생성 ~30s + LLM QA ~25s = 55s로 위험.
 *      Pro 플랜(maxDuration 300s)으로 올린 뒤 이 플래그를 켜면 지능형 검수가 동작한다.
 *    · LLM 호출 실패(네트워크·한도) → 자동 승인하지 않고 사람 검수로 폴백(안전).
 * 통과 = 자동 승인·발행, 실패 = 어드민 "검수 큐".
 */
export async function runAutoQa(markdown: string): Promise<QaResult> {
  const structuralIssues = runStructuralQa(markdown);
  if (structuralIssues.length > 0) {
    return { passed: false, issues: structuralIssues };
  }

  // 기본: 구조 검사만으로 자동 승인 (빠르고 안전 — 생성 단계가 이미 완결성 보장)
  if (process.env.QA_LLM_REVIEW !== "1") {
    return { passed: true, issues: [] };
  }

  // Pro 플랜 등에서 켜는 지능형 LLM 검수
  const provider = resolveQaProvider();
  if (!provider) return { passed: true, issues: [] };
  try {
    const llmIssues = await runLlmQaReview(markdown, provider);
    return { passed: llmIssues.length === 0, issues: llmIssues };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "자동 검수 오류";
    return {
      passed: false,
      issues: [`자동 품질 검수를 완료하지 못했습니다 (${msg}) — 사람 검수 필요`],
    };
  }
}
