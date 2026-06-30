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
import { deriveSchoolStage } from "./stage";

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

/**
 * LLM이 생성하는 관점(해석) 블록 — template.ts PerspectiveBlock과 동일 형태.
 * 모든 필드는 산문이며, 학교 사실·데이터 수치 표는 포함하지 않는다.
 */
export type LlmPerspective = PerspectiveBlock;

/** 필수 산문 필드 (schoolConnectionProse 포함 — 단일 요금제) */
export const REQUIRED_PROSE_FIELDS = [
  "dayMasterProse",
  "elementsProse",
  "tenGodsProse",
  "studyStyleProse",
  "studyAreasProse",
  "subjectTendencyProse",
  "aptitudeProse",
  "careerProse",
  "majorProse",
  "parentingProse",
  "stageProse",
  "eduStagesProse",
  "daeunProse",
  "annualProse",
  "schoolConnectionProse",
] as const;

/**
 * LLM 공급자 인터페이스.
 * 실제 구현: ClaudeLlmProvider.
 * 테스트: MockLlmProvider.
 */
export interface LlmProvider {
  /**
   * @param jsonSchema 지정 시 구조화 출력(JSON 유효성 보장) 요청. 미지정이면 일반 텍스트.
   *   목 구현은 무시해도 된다 (하위 호환).
   */
  complete(
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: Record<string, unknown>
  ): Promise<string>;
}

/** 산문 필드 JSON 스키마 — 단일 호출용 (그룹 병렬화에는 buildGroupSchema를 사용) */
export function buildProseSchema(): Record<string, unknown> {
  const fields: string[] = [...REQUIRED_PROSE_FIELDS];
  const properties: Record<string, unknown> = {};
  for (const f of fields) properties[f] = { type: "string" };
  return { type: "object", properties, required: fields, additionalProperties: false };
}

/** 그룹 단위 JSON 스키마 — 병렬 호출용 */
function buildGroupSchema(fields: readonly string[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const f of fields) properties[f] = { type: "string" };
  return { type: "object", properties, required: [...fields], additionalProperties: false };
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

  async complete(
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: Record<string, unknown>
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY 없음 — 통합 테스트 환경에서만 실행 가능"
      );
    }

    // 산문 11종(한국어, 토큰 밀도 높음) → 16K로는 잘린다. 32K로 올리되
    // 비스트리밍 고(高) max_tokens는 HTTP 타임아웃 위험 → 스트리밍 필수.
    // 구조화 출력(output_config.format)으로 JSON 유효성을 API가 보장(잘림 외 파싱 실패 차단).
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 8000,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };
    if (jsonSchema) {
      body.output_config = { format: { type: "json_schema", schema: jsonSchema } };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Claude API 오류: ${resp.status} — ${errText}`);
    }

    // SSE 스트림 파싱 — content_block_delta의 text_delta를 누적
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let stopReason: string | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string; stop_reason?: string };
          };
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            text += evt.delta.text ?? "";
          } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          }
        } catch {
          /* SSE 비-JSON 라인(ping 등) 무시 */
        }
      }
    }

    // max_tokens로 잘렸으면 JSON이 불완전 → 명시적 오류 (조용한 파싱 실패 방지)
    if (stopReason === "max_tokens") {
      throw new Error("Claude 응답이 max_tokens로 잘렸습니다 — max_tokens 상향 필요");
    }
    return text;
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
- 아이의 나이(대운 데이터의 만나이)에 맞는 생활 장면을 사용한다.

[톤 — 강점 중심·성장 지향 (중요)]
- 이 리포트는 한 아이에 대한 글이다. 전반적으로 아이의 가능성을 발견하고 북돋는 **긍정적·격려하는 톤**을 유지한다.
- 같은 기질도 약점이 아니라 "아직 자라는 중인 강점"으로 바라보고, 부모가 응원하고 싶어지도록 쓴다.
- 단, 듣기 좋은 말만 늘어놓지 않는다. 주의할 점·약한 부분이 있으면 **회피하지 말고 분명히 짚는다.**
- 다만 부정적인 지적은 절대 단독으로 끝내지 않는다. "이런 점은 흔들리기 쉽다 → 이렇게 도와주면(보완하면) 좋다"처럼 **반드시 구체적 보완·실천 제안과 한 쌍**으로 쓴다. 약점만 남기고 끝나는 문장은 금지.
- 단정적 낙인(예: "산만하다", "고집이 세다")은 피하고, "~한 경향이 있어 ~할 때 어려움을 느낄 수 있는데, ~해 주면 도움이 됩니다"처럼 풀어 쓴다.

[면책 문구 반복 금지 (중요)]
- "참고일 뿐입니다", "단정이 아닙니다", "경향 참고입니다" 같은 면책·유보 문구를 문단마다 반복하지 마세요. 면책은 리포트 말미에 한 번 일괄 고지됩니다.
- 각 산문은 군더더기 면책 없이 자신감 있고 따뜻하게 끝맺습니다. (단, "반드시·보장·틀림없이" 같은 단정·보장 표현 자체는 여전히 쓰지 않습니다.)`;

// ──────────────────────────────────────────────────────────────
// 필드 스펙 (필드별로 분리 — 그룹 병렬화에 사용)
// ──────────────────────────────────────────────────────────────

const SPEC_HEADER = `[작성할 산문 — 각 필드는 1~2문단, 공백 포함 200자 이상]`;

const FIELD_SPECS: Record<string, string> = {
  dayMasterProse:
    `- dayMasterProse: 일간(日干)이 뜻하는 아이의 타고난 본질·결. 일간 글자의 자연 상징(예: 壬=큰 물)으로 시작해 일상 모습으로 연결.`,
  elementsProse:
    `- elementsProse: 오행 분포에서 강한 기운과 약한(없는) 기운이 공부·생활에서 드러나는 방식. 약한 기운은 "보완 활동" 제안으로 마무리.`,
  tenGodsProse:
    `- tenGodsProse: 두드러진 십성 구조가 뜻하는 마음의 습관(배우는 방식·욕구·절제). 십성 명칭은 한글 병기.`,
  studyStyleProse:
    `- studyStyleProse: 위 기질을 종합한 공부 스타일 — 잘 맞는 학습 방식·환경·시간 운용, 흔들리기 쉬운 지점과 대처.`,
  studyAreasProse:
    `- studyAreasProse: 집중·암기·이해·표현·협동 5개 학습 영역 각각에 대해 이 아이의 기질이 어떻게 작동하는지. 영역마다 소제목 굵게(**집중** 등) + 1~2문장씩.`,
  subjectTendencyProse:
    `- subjectTendencyProse: 오행 분포를 과목(국어·수학·영어·과학·사회·예체능)과 연결해 풀이. 강한 오행이 잘 맞는 과목·학습법, 약한 오행 보완 제안 포함. 2~3문단.`,
  aptitudeProse:
    `- aptitudeProse: 이 아이가 기질적으로 뛰어난/잘 발현되는 강점 분야(예: 분석·탐구형, 표현·창작형, 사람·관계형 등)를 구체적으로 짚고, 그 강점을 어떤 방향으로 북돋아 주면 좋을지 제안. 약점은 "보완하며 함께 키울 결"로 따뜻하게. 단정("천재")이 아니라 "~한 강점 경향".`,
  careerProse:
    `- careerProse: 기질 관점에서 잘 맞을 수 있는 진로 분야를 2~3군으로 제시하고, 군마다 대표 직업 예시와 기질 연결 이유를 구체적으로. 특정 직업 단정 금지. 2~3문단.`,
  majorProse:
    `- majorProse: 잘 맞을 수 있는 **대학 전공·학문 계열을 2~3개 복수 제시**(각 계열에 왜 맞는지 한 줄)하고, 이 아이 기질이 국내 진학·해외 유학 중 어떤 환경과 잘 맞는지 덧붙인다. **특정 대학명을 사주로 단정하지 말 것** — "관심 전공이 정해지면 그 분야가 강한 국내외 대학을 직접 탐색하라"는 안내로 마무리. (면책 문구는 붙이지 않는다 — 말미 일괄 고지)`,
  parentingProse:
    `- parentingProse: 보호자가 참고할 코칭 포인트. "이럴 때는 ~해 주세요" 형식의 실천 항목 3가지 이상 포함.`,
  stageProse:
    `- stageProse: [아이 단계] 정보의 현 학령 단계(예: 예비 초등, 초등 3학년)에서 이 아이의 기질을 살리는 법.\n  그 단계의 실제 과업(입학 적응, 첫 시험, 자기주도 전환 등)과 기질을 구체적으로 연결한다. 단계 정보가 없으면 나이 기준으로 작성.`,
  eduStagesProse:
    `- eduStagesProse: **초등 / 중등 / 고등** 세 단계 각각에서 이 아이가 무엇을 챙기고 어떻게 접근하면 좋을지. 단계마다 소제목 굵게(**초등**, **중등**, **고등**) + 1문단씩, 총 3문단. 단계별로 부모의 역할·학습 초점이 어떻게 달라지는지 이 아이 기질에 맞춰 구체적으로.`,
  daeunProse:
    `- daeunProse: 학령기 대운 흐름 — 각 대운 구간(초등·중등·고등 시기)이 공부 여정에서 어떤 분위기로 해석되는지, 시기별 참고 포인트.`,
  annualProse:
    `- annualProse: 입력으로 주어진 향후 3년 세운(연간지) 각각의 기운을 아이의 원국에 비추어 해석. 연도별 1문단씩, 그해의 학습 생활 참고 포인트 포함.`,
  schoolConnectionProse:
    `- schoolConnectionProse: 이 아이 기질에 맞는 학교 환경 특성, 고교 유형(일반고·특목고·자율고·특성화고) 중 맞는 유형과 이유, 중학 준비 방향을 서술. 절대 금지: 학교명·순위·진학률. 1~2문단.`,
};

// ──────────────────────────────────────────────────────────────
// 병렬 생성용 필드 그룹 정의
//
// 단일 API 호출(전체 14필드, ~174s) → 4그룹 병렬 호출(각 ~35-45s)
// 그룹은 입출력 토큰 균형을 고려해 설계.
// ──────────────────────────────────────────────────────────────

type FieldGroupDef = {
  readonly name: string;
  readonly fields: readonly string[];
};

const FIELD_GROUPS: readonly FieldGroupDef[] = [
  {
    name: "core",
    fields: ["dayMasterProse", "elementsProse", "tenGodsProse", "studyStyleProse"],
  },
  {
    name: "learning",
    fields: ["studyAreasProse", "subjectTendencyProse"],
  },
  {
    name: "career",
    fields: ["aptitudeProse", "careerProse", "majorProse", "parentingProse"],
  },
  {
    name: "roadmap",
    fields: ["stageProse", "eduStagesProse", "daeunProse", "annualProse"],
  },
  {
    name: "school",
    fields: ["schoolConnectionProse"],
  },
];

/** 그룹 전용 시스템 프롬프트 빌더 */
function buildGroupSystemPrompt(group: FieldGroupDef): string {
  const fieldSpecLines = group.fields.map((f) => FIELD_SPECS[f] ?? "").join("\n");
  const jsonShape = `{\n${group.fields.map((f) => `  "${f}": "..."`).join(",\n")}\n}`;

  return `당신은 아동·청소년 공부 기질을 사주 명리 관점에서 해석하는 전문가입니다.
주어진 사주팔자(원국·오행·십성·대운) 데이터를 바탕으로 보호자에게 전달할 해석 산문을 작성합니다.

${FORBIDDEN_RULES}

${WRITING_STYLE}

${SPEC_HEADER}
${fieldSpecLines}

반드시 아래 JSON 형식으로만 응답한다. JSON 외 다른 텍스트를 포함하지 않는다:
${jsonShape}`;
}

/**
 * 비동기 작업을 실패 시 재시도한다 (지수 백오프).
 * 일시적 오류(API 흔들림·네트워크·타임아웃) 복구용.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/** 그룹 하나를 생성하고 Partial<LlmPerspective> 반환 */
async function generateGroup(
  group: FieldGroupDef,
  userPrompt: string,
  provider: LlmProvider
): Promise<Partial<LlmPerspective>> {
  const systemPrompt = buildGroupSystemPrompt(group);
  const schema = buildGroupSchema(group.fields);
  // API 호출만 재시도한다. 일시적 오류(네트워크·5xx·타임아웃)는 복구하되,
  // 아래의 JSON 파싱·필수 필드 검증 실패는 결정적이므로 재시도하지 않는다.
  const raw = await withRetry(() =>
    provider.complete(systemPrompt, userPrompt, schema)
  );

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `[그룹:${group.name}] LLM 응답이 JSON 형식이 아닙니다: "${raw.slice(0, 200)}"`
    );
  }

  let parsed: Partial<LlmPerspective>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Partial<LlmPerspective>;
  } catch {
    throw new Error(
      `[그룹:${group.name}] LLM 응답 JSON 파싱 실패: "${jsonMatch[0].slice(0, 200)}"`
    );
  }

  // 그룹 내 필수 필드 검증
  for (const field of group.fields) {
    const val = (parsed as Record<string, string | undefined>)[field];
    if (!val?.trim()) {
      throw new Error(`[그룹:${group.name}] LLM 응답에 ${field} 누락`);
    }
  }

  return parsed;
}

// ──────────────────────────────────────────────────────────────
// 사용자 프롬프트 빌더
// ──────────────────────────────────────────────────────────────

/**
 * SajuResult → LLM 사용자 프롬프트.
 * 학교 사실(학교명·주소·거리)은 포함하지 않는다.
 */
export function buildUserPrompt(
  saju: SajuResult,
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

  // 아이 단계 — 학령 단계·만나이 (stageProse 작성용. 학교명 등 사실은 전달하지 않는다)
  const baseYear = meta.currentYear ?? new Date().getFullYear();
  if (meta.birthYear !== undefined) {
    const stage = deriveSchoolStage(meta.birthYear, baseYear);
    lines.push(
      "",
      "[아이 단계]",
      `현 단계: ${stage.label} (기준 ${baseYear}년, 만 ${baseYear - meta.birthYear - 1}~${baseYear - meta.birthYear}세)`,
      `초등 입학: ${stage.elementaryEntryYear}년 3월 / 중학 입학: ${stage.middleEntryYear}년 3월 / 고교 입학: ${stage.highEntryYear}년 3월`
    );
  }

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

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────────────
// 핵심 함수
// ──────────────────────────────────────────────────────────────

/**
 * LLM을 호출해 관점 블록(해석 산문)을 생성한다.
 *
 * 4개(premium 5개) 필드 그룹을 병렬로 호출해 단일 호출 대비 ~4배 빠르게 생성한다.
 * (단일 호출 ~174s → 병렬 ~40-50s, Vercel 60s 함수 한계 내)
 *
 * 학교 사실은 이 함수 범위 밖 — template.ts(코드)가 별도 삽입.
 * 어느 그룹이라도 실패하면 전체 에러로 propagate.
 */
export async function generatePerspective(
  saju: SajuResult,
  provider: LlmProvider,
  meta: ReportMeta = {}
): Promise<LlmPerspective> {
  const userPrompt = buildUserPrompt(saju, meta);

  // 모든 그룹을 동시에 호출 — Promise.all은 하나라도 reject되면 전체 reject
  const partials = await Promise.all(
    FIELD_GROUPS.map((group) => generateGroup(group, userPrompt, provider))
  );

  // 그룹 결과 병합
  const merged = Object.assign({}, ...partials) as LlmPerspective;

  // 최종 필수 필드 검증 (각 그룹 내 검증 후 병합 결과 재확인)
  for (const field of REQUIRED_PROSE_FIELDS) {
    if (!merged[field]?.trim()) {
      throw new Error(`LLM 병렬 생성 후 ${field} 누락`);
    }
  }

  return merged;
}
