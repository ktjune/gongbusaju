/**
 * lib/report/generate.ts
 * LLM 관점(해석) 블록 생성
 *
 * [절대 규칙]
 * - LLM은 관점 산문(해석·연결)만 생성한다.
 * - 학교명·진학률·통학거리 등 학교 사실은 LLM에게 생성시키지 않는다.
 *   학교 사실은 template.ts(코드)가 별도로 삽입한다.
 * - 사주 데이터 표(원국·오행·십성·대운)도 template.ts(코드)가 생성한다.
 * - 시스템 프롬프트에 금지 규칙을 명시한다.
 *
 * 인터페이스(LlmProvider)를 분리해 테스트에서 mock으로 교체 가능.
 */

import type { SajuResult } from "../saju";
import { getYearGanji } from "../saju";
import type { PerspectiveBlock, ReportMeta } from "./template";

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

/**
 * LLM이 생성하는 관점(해석) 블록 — template.ts PerspectiveBlock과 동일 형태.
 * 모든 필드는 산문이며, 학교 사실·데이터 수치 표는 포함하지 않는다.
 */
export type LlmPerspective = PerspectiveBlock;

/** 모든 tier 공통 필수 산문 필드 */
export const REQUIRED_PROSE_FIELDS = [
  "dayMasterProse",
  "elementsProse",
  "tenGodsProse",
  "studyStyleProse",
  "studyAreasProse",
  "subjectTendencyProse",
  "parentingProse",
  "daeunProse",
  "annualProse",
] as const;

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
        max_tokens: 8192, // 산문 7개 섹션 — 충분한 출력 길이 확보
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

const FORBIDDEN_RULES = `[절대 금지 규칙]
1. 학교명·학교 주소·진학률·통학거리 등 학교에 관한 사실을 직접 언급하거나 생성하지 않는다.
2. 단정·보장 표현 금지: "반드시", "보장", "틀림없이", "확실히"
3. 특정 학교를 정답으로 연결하는 표현 금지: "이 학교 가면 된다", "이 학교가 정답", "이 학교에 가야 한다"
4. 사주→학교 인과 단정 금지: "이 사주면 이 학교가 맞다", "오행이 X라 Y학교가 최적"
5. "예측", "최적화" 대신 "참고", "경향", "해석"을 사용한다.
6. 의학·심리 진단으로 읽힐 표현 금지. 해석은 "~경향이 있습니다", "~로 풀이됩니다"로 작성한다.`;

const WRITING_STYLE = `[문체 — 가독성 우선]
- 독자는 아이의 보호자(부모)다. 따뜻하고 구체적으로, 존댓말로 쓴다.
- 한 문단은 2~4문장으로 짧게 끊는다. 문단 사이는 빈 줄(\\n\\n)로 구분한다.
- 각 산문에서 가장 중요한 핵심 문장 1개는 **굵게** 표시한다.
- 전문 용어(오행·십성·대운)는 처음 나올 때 짧게 풀어 쓴다.
- 각 산문은 추상적 칭찬이 아니라 "일상·공부 장면에서 어떻게 드러나는지"를 구체적 예시로 보여준다.
- 아이의 나이(대운 데이터의 만나이)에 맞는 생활 장면을 사용한다.`;

const FIELD_SPEC_BASIC = `[작성할 산문 — 각 필드는 2~3문단, 공백 포함 400자 이상]
- dayMasterProse: 일간(日干)이 뜻하는 아이의 타고난 본질·결. 일간 글자의 자연 상징(예: 壬=큰 물)으로 시작해 일상 모습으로 연결.
- elementsProse: 오행 분포에서 강한 기운과 약한(없는) 기운이 공부·생활에서 드러나는 방식. 약한 기운은 "보완 활동" 제안으로 마무리.
- tenGodsProse: 두드러진 십성 구조가 뜻하는 마음의 습관(배우는 방식·욕구·절제). 십성 명칭은 한글 병기.
- studyStyleProse: 위 기질을 종합한 공부 스타일 — 잘 맞는 학습 방식·환경·시간 운용, 흔들리기 쉬운 지점과 대처.
- studyAreasProse: 집중·암기·이해·표현·협동 5개 학습 영역 각각에 대해 이 아이의 기질이 어떻게 작동하는지. 영역마다 소제목 굵게(**집중** 등) + 1문단씩, 총 5문단.
- subjectTendencyProse: 오행-학습영역 전통 매핑을 이 아이의 오행 분포에 비추어 풀이. 강한 오행이 가리키는 영역과 옅은 오행 영역의 접근법. 적성 단정 금지, "경향 참고"로 일관.
- parentingProse: 보호자가 참고할 코칭 포인트. "이럴 때는 ~해 주세요" 형식의 실천 항목 3가지 이상 포함.
- daeunProse: 학령기 대운 흐름 — 각 대운 구간(초등·중등·고등 시기)이 공부 여정에서 어떤 분위기로 해석되는지, 시기별 참고 포인트.
- annualProse: 입력으로 주어진 향후 3년 세운(연간지) 각각의 기운을 아이의 원국에 비추어 해석. 연도별 1문단씩, 그해의 학습 생활 참고 포인트 포함.`;

const FIELD_SPEC_PREMIUM_EXTRA = `- schoolConnectionProse: 이 아이의 기질에서 학교 '환경'을 고를 때 참고할 만한 경향 (300자 이상).
  절대 금지: 학교명·주소·순위·진학률 등 사실 정보. 순수 기질·성향 관점만 작성.
  마지막은 "여러 요소를 종합해 보호자께서 판단"하라는 안내로 마무리.`;

const JSON_SHAPE_BASIC = `{
  "dayMasterProse": "...",
  "elementsProse": "...",
  "tenGodsProse": "...",
  "studyStyleProse": "...",
  "studyAreasProse": "...",
  "subjectTendencyProse": "...",
  "parentingProse": "...",
  "daeunProse": "...",
  "annualProse": "..."
}`;

const JSON_SHAPE_PREMIUM = `{
  "dayMasterProse": "...",
  "elementsProse": "...",
  "tenGodsProse": "...",
  "studyStyleProse": "...",
  "studyAreasProse": "...",
  "subjectTendencyProse": "...",
  "parentingProse": "...",
  "daeunProse": "...",
  "annualProse": "...",
  "schoolConnectionProse": "..."
}`;

/** Basic 시스템 프롬프트 — 사주 해석 산문 6종 */
const SYSTEM_PROMPT_BASIC = `당신은 아동·청소년 공부 기질을 사주 명리 관점에서 해석하는 전문가입니다.
주어진 사주팔자(원국·오행·십성·대운) 데이터를 바탕으로 보호자에게 전달할 해석 산문을 작성합니다.

${FORBIDDEN_RULES}

${WRITING_STYLE}

${FIELD_SPEC_BASIC}

반드시 아래 JSON 형식으로만 응답한다. JSON 외 다른 텍스트를 포함하지 않는다:
${JSON_SHAPE_BASIC}`;

/** Premium 시스템 프롬프트 — + 학교 선택 기질 관점 */
const SYSTEM_PROMPT_PREMIUM = `당신은 아동·청소년 공부 기질을 사주 명리 관점에서 해석하는 전문가입니다.
주어진 사주팔자(원국·오행·십성·대운) 데이터를 바탕으로 보호자에게 전달할 해석 산문을 작성합니다.

${FORBIDDEN_RULES}

${WRITING_STYLE}

${FIELD_SPEC_BASIC}
${FIELD_SPEC_PREMIUM_EXTRA}

반드시 아래 JSON 형식으로만 응답한다. JSON 외 다른 텍스트를 포함하지 않는다:
${JSON_SHAPE_PREMIUM}`;

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
  tier: "basic" | "premium",
  meta: ReportMeta = {}
): string {
  const daeunList = saju.daeun
    .slice(0, 5)
    .map((d) => `만 ${d.age}세 ${d.startMonths}개월~: ${d.ganji}`)
    .join(", ");

  const elementsStr = Object.entries(saju.elements)
    .map(([k, v]) => `${k} ${Math.round(v)}%`)
    .join(", ");

  const tenGodsStr = Object.entries(saju.tenGods)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const traitsStr = Object.entries(saju.traitScores)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");

  const lines: string[] = [
    "[사주팔자]",
    `년주: ${saju.pillars.year}`,
    `월주: ${saju.pillars.month}`,
    `일주: ${saju.pillars.day} (일간 = ${saju.pillars.day.charAt(0)})`,
    `시주: ${saju.pillars.hour ?? "(시간 모름)"}`,
    "",
    "[오행 분포]",
    elementsStr,
    "",
    "[십성 — 본기 기준, 높은 순]",
    tenGodsStr || "(데이터 없음)",
    "",
    "[대운 — 만나이 기준]",
    daeunList || "(데이터 없음)",
    "",
    "[기질 지표 (규칙표 환산값, 참고용)]",
    traitsStr || "(데이터 없음)",
  ];

  // 세운 — 향후 3년 연간지 (annualProse 작성용)
  const fromYear = meta.currentYear ?? new Date().getFullYear();
  const annualStr = [0, 1, 2]
    .map((i) => {
      const y = fromYear + i;
      const age = meta.birthYear !== undefined ? ` (만 ${y - meta.birthYear}세 무렵)` : "";
      return `${y}년: ${getYearGanji(y)}${age}`;
    })
    .join(", ");
  lines.push("", "[세운 — 향후 3년]", annualStr);

  if (tier === "premium") {
    lines.push(
      "",
      "[참고]",
      "이 리포트는 Premium 요금제입니다.",
      "schoolConnectionProse 필드에 학교 환경 선택 시 참고할 기질 경향을 작성해 주세요.",
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
  provider: LlmProvider,
  meta: ReportMeta = {}
): Promise<LlmPerspective> {
  const systemPrompt =
    tier === "premium" ? SYSTEM_PROMPT_PREMIUM : SYSTEM_PROMPT_BASIC;
  const userPrompt = buildUserPrompt(saju, tier, meta);

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
  for (const field of REQUIRED_PROSE_FIELDS) {
    if (!parsed[field]?.trim()) {
      throw new Error(`LLM 응답에 ${field} 누락`);
    }
  }
  if (tier === "premium" && !parsed.schoolConnectionProse?.trim()) {
    throw new Error("LLM Premium 응답에 schoolConnectionProse 누락");
  }

  return parsed;
}
