/**
 * lib/report/guardrails.ts
 * LLM 생성 텍스트 금지표현 검사기
 *
 * [절대 규칙] CLAUDE.md §3 — 표시광고법 리스크:
 *   단정·보장 표현, 사주→특정 학교 인과 연결 금지.
 *   이 검사를 통과하지 못하면 리포트 발행이 차단된다.
 *
 * 검사 대상: LLM이 생성한 관점 블록(PerspectiveBlock)만.
 * 코드가 삽입하는 사실 블록(FactBlock)은 검사 대상이 아니다.
 */

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export type GuardrailViolation = {
  /** 매칭된 패턴 소스 */
  pattern: string;
  /** 실제 매칭 문자열 */
  matched: string;
  /** 위반 이유 설명 */
  reason: string;
};

/** guardrails 위반 시 던지는 에러 — 발행 차단 */
export class GuardrailError extends Error {
  readonly violations: GuardrailViolation[];

  constructor(violations: GuardrailViolation[]) {
    super(
      `리포트 금지 표현 감지 (${violations.length}건): ` +
        violations.map((v) => v.reason).join(" / ")
    );
    this.name = "GuardrailError";
    this.violations = violations;
  }
}

// ──────────────────────────────────────────────────────────────
// 금지 규칙 테이블
// ──────────────────────────────────────────────────────────────

type GuardrailRule = {
  pattern: RegExp;
  reason: string;
};

/**
 * 금지 패턴 목록.
 *
 * 패턴 설계 원칙:
 * - 오탐(false positive) 최소화: "학교" 단어 자체는 허용, 인과·단정 맥락만 금지
 * - 미탐(false negative) 감수: 자동 검사는 1차 방어선. 사람 검수가 최종.
 */
const FORBIDDEN_RULES: GuardrailRule[] = [
  // ── 단정·보장 ─────────────────────────────────────────────
  {
    pattern: /보장/,
    reason: '보장 표현 ("보장합니다", "보장됩니다" 등)',
  },
  {
    pattern: /틀림없이/,
    reason: '단정 표현 "틀림없이"',
  },
  {
    pattern: /반드시\s*(?:이|저|그|해당|배정|가까운|주변)?[\s가-힣]{0,6}학교/,
    reason: '단정 표현 "반드시 [학교]"',
  },
  {
    pattern: /확실히\s*(?:이|저|그|해당|배정)?[\s가-힣]{0,6}학교/,
    reason: '단정 표현 "확실히 [학교]"',
  },
  // ── "이 학교 가면 된다" 유사 패턴 ────────────────────────
  {
    pattern: /이\s*학교\s*(?:가면|에\s*가면|에\s*다니면)\s*(?:된다|됩니다|좋다|좋습니다|맞다|맞습니다)/,
    reason: '"이 학교 가면 된다" 유사 표현',
  },
  {
    pattern: /이\s*학교에?\s*가야\s*(?:한다|합니다|돼요|됩니다)/,
    reason: '"이 학교에 가야 한다" 유사 표현',
  },
  // ── 학교 "정답" 연결 ──────────────────────────────────────
  {
    pattern: /(?:이|저|해당|배정)\s*학교(?:가|이|는|을)?\s*정답/,
    reason: '특정 학교 "정답" 단정',
  },
  {
    pattern: /학교(?:가|이|는)?\s*딱\s*(?:맞다|입니다|이에요)/,
    reason: '학교 "딱 맞다" 단정',
  },
  // ── 사주→학교 인과 단정 ───────────────────────────────────
  {
    pattern: /사주.{0,20}학교.{0,10}(?:정답|최적|딱|맞다|맞습니다|가야)/,
    reason: "사주→학교 인과 단정",
  },
  {
    pattern: /오행.{0,20}학교.{0,10}(?:정답|최적|딱|맞다|맞습니다|가야)/,
    reason: "오행→학교 인과 단정",
  },
];

// ──────────────────────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────────────────────

/**
 * LLM 생성 텍스트에서 금지 표현을 검사한다.
 *
 * @throws {GuardrailError} 금지 표현이 1건 이상 발견되면
 */
export function checkGuardrails(text: string): void {
  const violations: GuardrailViolation[] = [];

  for (const rule of FORBIDDEN_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      violations.push({
        pattern: rule.pattern.source,
        matched: match[0],
        reason: rule.reason,
      });
    }
  }

  if (violations.length > 0) {
    throw new GuardrailError(violations);
  }
}

/**
 * 텍스트가 guardrails를 통과하는지 여부를 반환한다.
 * 에러를 던지지 않는 안전한 버전.
 */
export function passesGuardrails(text: string): boolean {
  try {
    checkGuardrails(text);
    return true;
  } catch {
    return false;
  }
}
