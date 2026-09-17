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
    pattern: /무조건/,
    reason: '단정 표현 "무조건"',
  },
  {
    pattern: /100\s*%\s*(?:보장|확실|성공|합격|효과)/,
    reason: '수치 보장 단정 "100% …"',
  },
  {
    pattern: /반드시\s*(?:이|저|그|해당|배정|가까운|주변)?[\s가-힣]{0,6}학교/,
    reason: '단정 표현 "반드시 [학교]"',
  },
  {
    pattern: /확실히\s*(?:이|저|그|해당|배정)?[\s가-힣]{0,6}학교/,
    reason: '단정 표현 "확실히 [학교]"',
  },
  // ── 성취·결과 약속 ───────────────────────────────────────
  // 사주 해석이 합격·성적 같은 결과로 이어진다고 읽히는 문장.
  // 프롬프트는 이미 "성취·성적·결과를 약속하는 문장은 쓰지 않는다"고 요구하지만
  // 코드 검사가 없어서, 유료 리포트(2026-09-15)에 "공인된 점수와 합격이라는
  // 든든한 결과로 이어지기 무척 유리한 흐름"이 그대로 발행됐다.
  // "합격선"(입시 기준점을 가리키는 중립 표현)은 제외한다.
  {
    pattern: /합격(?!선)/,
    reason: '결과 약속 "합격"',
  },
  {
    pattern: /(?:성적|점수|등수|내신|석차)(?:이|가|을|를|도)?\s*(?:쑥쑥\s*)?(?:오[르를른]|올[라랐려리릴린]|향상|높아|높[이일인])/,
    // 한글은 음절이 결합돼 "오를"이 "오르"로 시작하지 않는다 — 활용형을 음절로 나열한다
    reason: "성적 상승 약속",
  },
  {
    pattern: /명문대|명문\s*학교|상위권\s*(?:대학|진입|도약)|최상위권/,
    reason: "명문·상위권 연결 (줄세우기·결과 약속)",
  },
  {
    pattern: /(?:좋은|든든한|확실한|뛰어난)\s*(?:성적|점수|결과)(?:로|를|가|이)?\s*(?:이어지|거두|얻|받|낼)/,
    reason: "좋은 결과 약속",
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
  // ── 학교·직업 "적합" 단정 ─────────────────────────────────
  {
    pattern: /(?:학교|고등학교|특목고|자율고|일반고|특성화고)(?:가|이|에)?\s*(?:가장\s*)?적합합니다/,
    reason: '학교 유형 "적합합니다" 단정 (→ "잘 맞는 경향이 있습니다" 권장)',
  },
  {
    pattern: /(?:직업|진로|전공)(?:이|으로)?\s*(?:가장\s*)?적합합니다/,
    reason: '직업·전공 "적합합니다" 단정 (→ "경향이 있습니다" 권장)',
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
