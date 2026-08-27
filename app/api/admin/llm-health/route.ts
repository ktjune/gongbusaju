/**
 * GET /api/admin/llm-health — LLM 공급자 생존 확인 (어드민 "비용" 섹션)
 *
 * 왜 필요한가: 2026-08-26에 Anthropic 크레딧이 소진돼 폴백이 죽어 있었는데,
 * Gemini가 잘 도는 동안에는 아무도 몰랐다. 다른 작업을 하다 우연히 발견했다.
 * **폴백은 정작 필요한 순간에 처음 호출된다** — 그때 죽어 있으면 이미 늦다.
 * 그래서 평소에 값싸게 찔러보고 상태를 보여준다.
 *
 * 비용: 모델당 입력 몇 토큰 + 출력 1토큰. 사실상 0원이다.
 *
 * 인증: middleware.ts — admin 세션
 */

import { GeminiLlmProvider } from "@/lib/report/gemini";
import { ClaudeLlmProvider } from "@/lib/report/generate";
import type { LlmProvider } from "@/lib/report/generate";

export const runtime = "nodejs";
export const maxDuration = 30;

/** 한 글자만 답하게 해 출력 토큰을 최소화한다 */
const PING_SYSTEM = "Reply with the single character: 1";
const PING_USER = "ping";

type Probe = {
  /** 화면에 보일 이름 */
  label: string;
  /** 이 자리의 역할 — 주력인지 폴백인지 */
  role: "primary" | "fallback";
  provider: LlmProvider;
};

type ProbeResult = {
  label: string;
  role: Probe["role"];
  ok: boolean;
  ms: number;
  error?: string;
};

function buildProbes(): Probe[] {
  const probes: Probe[] = [];
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
  const geminiFallback = process.env.GEMINI_FALLBACK_MODEL?.trim();

  if (process.env.GEMINI_API_KEY) {
    probes.push({
      label: `Gemini · ${geminiModel}`,
      role: "primary",
      provider: new GeminiLlmProvider(),
    });
    if (geminiFallback) {
      probes.push({
        label: `Gemini · ${geminiFallback}`,
        role: "fallback",
        provider: new GeminiLlmProvider(undefined, geminiFallback),
      });
    }
  }

  // Gemini가 없을 때만 실제 생성 경로에 오르지만, 키가 설정돼 있으면
  // 상태를 함께 보여준다(설정해 뒀는데 죽어 있는 상황을 드러내기 위해).
  if (process.env.ANTHROPIC_API_KEY) {
    probes.push({
      label: "Claude · sonnet",
      role: process.env.GEMINI_API_KEY ? "fallback" : "primary",
      provider: new ClaudeLlmProvider(),
    });
  }

  return probes;
}

async function probe(p: Probe): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    await p.provider.complete(PING_SYSTEM, PING_USER);
    return { label: p.label, role: p.role, ok: true, ms: Date.now() - t0 };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      label: p.label,
      role: p.role,
      ok: false,
      ms: Date.now() - t0,
      // 키가 통째로 실릴 수 있는 URL 등은 자르고 앞부분만 남긴다
      error: raw.replace(/key=[\w-]+/g, "key=***").slice(0, 200),
    };
  }
}

export async function GET() {
  const probes = buildProbes();

  if (probes.length === 0) {
    return Response.json({
      providers: [],
      note: "LLM 키가 설정되지 않았습니다 — 데모 목업으로 동작합니다.",
    });
  }

  const providers = await Promise.all(probes.map(probe));
  const primaryOk = providers.some((p) => p.role === "primary" && p.ok);
  const hasFallback = providers.some((p) => p.role === "fallback");
  const fallbackOk = providers.some((p) => p.role === "fallback" && p.ok);

  return Response.json({
    providers,
    primaryOk,
    hasFallback,
    fallbackOk,
    note: !primaryOk
      ? "주력 공급자가 응답하지 않습니다 — 리포트 생성이 실패합니다."
      : !hasFallback
        ? "폴백이 설정되지 않았습니다. GEMINI_FALLBACK_MODEL을 넣으면 레이트리밋 구간을 넘길 수 있습니다."
        : !fallbackOk
          ? "폴백이 설정돼 있으나 응답하지 않습니다 — 모델명·크레딧을 확인하세요."
          : null,
  });
}
