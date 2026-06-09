/**
 * lib/report/generate.ts
 * LLM 관점(해석) 블록 생성
 *
 * [절대 규칙]
 * - LLM은 관점 산문(해석·연결)만 생성한다.
 * - 학교명·진학률·통학거리 등 학교 사실은 LLM에게 생성시키지 않는다.
 *   학교 사실은 template.ts(코드)가 별도로 삽입한다.
 * - 시스템 프롬프트에 금지 규칙을 명시한다.
 *
 * 인터페이스(LlmProvider)를 분리해 테스트에서 mock으로 교체 가능.
 */

import type { SajuResult } from "../saju";

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

/** LLM이 생성하는 관점(해석) 블록 */
export type LlmPerspective = {
  /** 오행·십성 기반 공부 기질 해석 산문 (LLM 작성) */
  studyTraitsProse: string;
  /** 현재 대운 기준 공부·성장 흐름 해석 산문 (LLM 작성) */
  daeunProse: string;
  /**
   * [Premium] 사주 기질 관점에서 학교 선택 시 참고할 경향 산문.
   * 학교명·순위·진학률 등 사실 절대 포함 금지 — 기질 관점만.
   */
  schoolConnectionProse?: string;
};

/**
 * LLM 공급자 인터페이스.
 * 실제 구현: ClaudeLlmProvider.
 * 테스트: MockLlmProvider.
 */
export interface LlmProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

// ──────────────────────────────────────────────────────────────
// Claude API 실제 구현
// ──────────────────────────────────────────────────────────────

/**
 * Anthropic Claude Sonnet API 구현체.
 * ANTHROPIC_API_KEY 환경변수 필요.
 */
export class ClaudeLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    apiKey?: string,
    model = "claude-sonnet-4-6"
  ) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY 없음 — 통합 테스트 환경에서만 실행 가능"
      );
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API 오류: ${resp.status} — ${errText}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }
}

// ──────────────────────────────────────────────────────────────
// 시스템 프롬프트
// ──────────────────────────────────────────────────────────────

/** Basic 공통 시스템 프롬프트 — 사주 해석만 */
const SYSTEM_PROMPT_BASIC = `당신은 사주 기질 해석 전문가입니다.
주어진 사주팔자(오행·십성·대운) 데이터를 바탕으로 공부 기질과 대운 흐름을 해석하는 산문을 작성합니다.

[절대 금지 규칙]
1. 학교명·학교 주소·진학률·통학거리 등 학교에 관한 사실을 직접 언급하거나 생성하지 않는다.
2. 단정·보장 표현 금지: "반드시", "보장", "틀림없이", "확실히"
3. 특정 학교를 정답으로 연결하는 표현 금지: "이 학교 가면 된다", "이 학교가 정답", "이 학교에 가야 한다"
4. 사주→학교 인과 단정 금지: "이 사주면 이 학교가 맞다", "오행이 X라 Y학교가 최적"
5. "예측", "최적화" 대신 "참고", "경향", "해석"을 사용한다.

[작성 역할]
- studyTraitsProse: 오행 분포·십성에서 드러나는 공부 기질·학습 스타일 해석 (200자 이상)
- daeunProse: 현재 대운 기준 공부·성장 흐름 해석 (150자 이상)

반드시 아래 JSON 형식으로만 응답한다. JSON 외 다른 텍스트를 포함하지 않는다:
{
  "studyTraitsProse": "...",
  "daeunProse": "..."
}`;

/** Premium 추가 필드: 학교 선택 기질 관점 */
const SYSTEM_PROMPT_PREMIUM = `당신은 사주 기질 해석 전문가입니다.
주어진 사주팔자(오행·십성·대운) 데이터를 바탕으로 공부 기질과 대운 흐름을 해석하는 산문을 작성합니다.

[절대 금지 규칙]
1. 학교명·학교 주소·진학률·통학거리 등 학교에 관한 사실을 직접 언급하거나 생성하지 않는다.
2. 단정·보장 표현 금지: "반드시", "보장", "틀림없이", "확실히"
3. 특정 학교를 정답으로 연결하는 표현 금지: "이 학교 가면 된다", "이 학교가 정답", "이 학교에 가야 한다"
4. 사주→학교 인과 단정 금지: "이 사주면 이 학교가 맞다", "오행이 X라 Y학교가 최적"
5. "예측", "최적화" 대신 "참고", "경향", "해석"을 사용한다.

[작성 역할]
- studyTraitsProse: 오행 분포·십성에서 드러나는 공부 기질·학습 스타일 해석 (200자 이상)
- daeunProse: 현재 대운 기준 공부·성장 흐름 해석 (150자 이상)
- schoolConnectionProse: 이 아이의 사주 기질에서 학교 환경 선택 시 '참고할 만한 기질 경향' 산문 (150자 이상).
  절대 금지: 학교명·주소·순위·진학률 등 사실 정보. 순수 기질·성향 관점만 작성.
  예시 방향: "활동적 에너지가 강한 경향이 있어, 체험·활동 중심 학습 환경에서 기질이 잘 발현될 수 있습니다."

반드시 아래 JSON 형식으로만 응답한다. JSON 외 다른 텍스트를 포함하지 않는다:
{
  "studyTraitsProse": "...",
  "daeunProse": "...",
  "schoolConnectionProse": "..."
}`;

// ──────────────────────────────────────────────────────────────
// 사용자 프롬프트 빌더
// ──────────────────────────────────────────────────────────────

/**
 * SajuResult → LLM 사용자 프롬프트.
 * 학교 사실(학교명·주소·거리)은 포함하지 않는다.
 * Premium tier에는 "학교 맥락 있음" 힌트만 전달해 schoolConnectionProse 유도.
 */
export function buildUserPrompt(
  saju: SajuResult,
  tier: "basic" | "premium"
): string {
  const daeunTop3 = saju.daeun
    .slice(0, 3)
    .map((d) => `${d.age}세~: ${d.ganji}`)
    .join(", ");

  const elementsStr = Object.entries(saju.elements)
    .map(([k, v]) => `${k} ${v}%`)
    .join(", ");

  const tenGodsStr = Object.entries(saju.tenGods)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const lines: string[] = [
    "[사주팔자]",
    `년주: ${saju.pillars.year}`,
    `월주: ${saju.pillars.month}`,
    `일주: ${saju.pillars.day}`,
    `시주: ${saju.pillars.hour ?? "(시간 모름)"}`,
    "",
    "[오행 분포]",
    elementsStr,
    "",
    "[십성 (높은 순)]",
    tenGodsStr || "(데이터 없음)",
    "",
    "[대운 (상위 3구간)]",
    daeunTop3 || "(데이터 없음)",
  ];

  if (tier === "premium") {
    lines.push(
      "",
      "[참고]",
      "이 리포트는 Premium 요금제입니다.",
      "schoolConnectionProse 필드에 학교 선택 시 참고할 기질 경향을 작성해 주세요.",
      "학교명·주소·진학률 등 사실 정보는 절대 포함하지 않습니다."
    );
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────────────────────

/**
 * LLM을 호출해 관점 블록(해석 산문)을 생성한다.
 *
 * 학교 사실은 이 함수 범위 밖 — template.ts(코드)가 별도 삽입.
 * LLM 응답이 JSON 아니거나 필수 필드 누락이면 에러.
 */
export async function generatePerspective(
  saju: SajuResult,
  tier: "basic" | "premium",
  provider: LlmProvider
): Promise<LlmPerspective> {
  const systemPrompt =
    tier === "premium" ? SYSTEM_PROMPT_PREMIUM : SYSTEM_PROMPT_BASIC;
  const userPrompt = buildUserPrompt(saju, tier);

  const raw = await provider.complete(systemPrompt, userPrompt);

  // JSON 추출 — LLM이 앞뒤로 불필요한 텍스트를 붙일 수 있으므로
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `LLM 응답이 JSON 형식이 아닙니다: "${raw.slice(0, 200)}"`
    );
  }

  let parsed: LlmPerspective;
  try {
    parsed = JSON.parse(jsonMatch[0]) as LlmPerspective;
  } catch {
    throw new Error(`LLM 응답 JSON 파싱 실패: "${jsonMatch[0].slice(0, 200)}"`);
  }

  // 필수 필드 검증
  if (!parsed.studyTraitsProse?.trim()) {
    throw new Error("LLM 응답에 studyTraitsProse 누락");
  }
  if (!parsed.daeunProse?.trim()) {
    throw new Error("LLM 응답에 daeunProse 누락");
  }
  if (tier === "premium" && !parsed.schoolConnectionProse?.trim()) {
    throw new Error("LLM Premium 응답에 schoolConnectionProse 누락");
  }

  return parsed;
}
