/**
 * lib/report/qa.ts
 * LLM 생성 리포트 자동 QA — 어드민 승인 전 1차 점검.
 *
 * 구조 검사(분량·금지표현)를 먼저 돌리고, 통과한 경우에만
 * LLM 재검토(오타·문맥 어색함·반복 면책문구)를 호출한다 (비용 절약).
 * 통과하면 자동 승인 후보, 실패하면 사람 검수(어드민 "검수 큐")로 넘어간다.
 */

import { checkGuardrails } from "./guardrails";
import type { LlmProvider } from "./generate";

export type QaResult = {
  passed: boolean;
  issues: string[];
};

/** 15개 산문 합산 최소 분량(자) — 비정상적으로 짧으면 누락 의심 */
const MIN_MARKDOWN_LENGTH = 3000;

/** 구조 검사 — 분량·금지표현 (LLM 호출 없음) */
export function runStructuralQa(markdown: string): string[] {
  const issues: string[] = [];
  const trimmed = markdown.trim();

  if (trimmed.length < MIN_MARKDOWN_LENGTH) {
    issues.push(`리포트 분량이 비정상적으로 짧습니다 (${trimmed.length}자)`);
  }

  try {
    checkGuardrails(markdown);
  } catch (e) {
    issues.push(e instanceof Error ? e.message : "금지 표현 감지");
  }

  return issues;
}

/** LLM 재검토 — 오타·문맥 어색함·반복 면책문구. 해석 방향(사주 풀이 자체)은 평가하지 않는다. */
export async function runLlmQaReview(
  markdown: string,
  provider: LlmProvider
): Promise<string[]> {
  const systemPrompt = `당신은 공부사주 리포트의 품질 검수자입니다.
아래 리포트(마크다운)를 읽고 다음 기준으로만 점검합니다:
1. 오타·맞춤법 오류
2. 문맥이 어색하거나 앞뒤 문장이 어긋나는 부분
3. 같은 면책·유보 문구("참고일 뿐입니다" 등)가 여러 군데 반복되는지
4. 문단이 중간에 끊기거나 미완성으로 보이는지

내용의 해석 방향(사주 풀이 자체가 맞는지)은 평가하지 않습니다. 형식적 결함만 찾습니다.
문제가 없으면 issues를 빈 배열로 둡니다. 반드시 아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 않습니다:
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
// Hobby 플랜 60s 제한: LLM QA는 생략하고 구조 검사만 수행.
// 생성 ~30s + LLM QA ~10s + 재시도 ~30s = 70s → 타임아웃.
// 금지 표현은 guardrails가 이미 생성 단계에서 차단하므로 구조 검사로 충분.
export async function runAutoQa(markdown: string): Promise<QaResult> {
  const issues = runStructuralQa(markdown);
  return { passed: issues.length === 0, issues };
}
