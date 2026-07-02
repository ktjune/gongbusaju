/**
 * lib/report/gemini.ts
 * Google Gemini LLM 공급자 + 폴백 래퍼.
 *
 * - GeminiLlmProvider: Gemini API 구현체 (무료 티어 활용).
 * - FallbackLlmProvider: primary 실패 시 fallback으로 자동 전환
 *   (Gemini 무료 한도 초과·장애 시 Claude로 폴백).
 *
 * 두 공급자 모두 generate.ts의 LlmProvider 인터페이스를 구현하므로
 * 리포트 생성 파이프라인에 그대로 주입할 수 있다.
 *
 * 환경변수:
 *   GEMINI_API_KEY  — Google AI Studio 발급 키 (aistudio.google.com/apikey)
 *   GEMINI_MODEL    — 모델 ID (기본: gemini-2.0-flash)
 */

import type { LlmProvider } from "./generate";

// ──────────────────────────────────────────────────────────────
// Gemini 공급자
// ──────────────────────────────────────────────────────────────

/** 우리 JSON 스키마 → Gemini responseSchema(OpenAPI 서브셋) 변환.
 *  Gemini는 대문자 타입만 받고 additionalProperties를 지원하지 않는다. */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const TYPE_MAP: Record<string, string> = {
    object: "OBJECT",
    string: "STRING",
    array: "ARRAY",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
  };
  const conv = (s: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (typeof s.type === "string") out.type = TYPE_MAP[s.type] ?? s.type;
    if (s.properties && typeof s.properties === "object") {
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties as Record<string, unknown>)) {
        props[k] = conv(v as Record<string, unknown>);
      }
      out.properties = props;
    }
    if (s.items && typeof s.items === "object") {
      out.items = conv(s.items as Record<string, unknown>);
    }
    if (Array.isArray(s.required)) out.required = s.required;
    // additionalProperties는 의도적으로 제외 (Gemini 미지원)
    return out;
  };
  return conv(schema);
}

/**
 * Google Gemini API 구현체.
 * GEMINI_API_KEY 환경변수 필요.
 */
export class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.model = model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: Record<string, unknown>
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY 없음 — Gemini 공급자 사용 불가");
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.model}:generateContent?key=${this.apiKey}`;

    const generationConfig: Record<string, unknown> = { maxOutputTokens: 8000 };
    if (jsonSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = toGeminiSchema(jsonSchema);
    }

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Gemini API 오류: ${resp.status} — ${errText}`);
    }

    const data = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini 응답이 MAX_TOKENS로 잘렸습니다 — maxOutputTokens 상향 필요");
    }

    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");

    if (!text.trim()) {
      throw new Error(
        `Gemini 응답이 비어 있습니다 (finishReason: ${candidate?.finishReason ?? "unknown"})`
      );
    }
    return text;
  }
}

// ──────────────────────────────────────────────────────────────
// 폴백 래퍼
// ──────────────────────────────────────────────────────────────

/**
 * primary 공급자 실패 시 fallback으로 자동 전환하는 래퍼.
 * (Gemini 무료 한도 초과·장애 → Claude 폴백)
 */
export class FallbackLlmProvider implements LlmProvider {
  constructor(
    private readonly primary: LlmProvider,
    private readonly fallback: LlmProvider
  ) {}

  async complete(
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: Record<string, unknown>
  ): Promise<string> {
    try {
      return await this.primary.complete(systemPrompt, userPrompt, jsonSchema);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[llm] primary 공급자 실패 — fallback 시도: ${msg}`);
      return await this.fallback.complete(systemPrompt, userPrompt, jsonSchema);
    }
  }
}
