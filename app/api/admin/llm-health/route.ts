/**
 * GET /api/admin/llm-health — LLM 공급자 생존 확인 (어드민 "비용" 섹션)
 *
 * 판정 로직은 lib/report/llm-health (운영 요약 ops-digest와 공유).
 *
 * 인증: middleware.ts — admin 세션
 */

import { checkLlmHealth } from "@/lib/report/llm-health";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const health = await checkLlmHealth();

  if (!health) {
    return Response.json({
      providers: [],
      note: "LLM 키가 설정되지 않았습니다 — 데모 목업으로 동작합니다.",
    });
  }

  return Response.json(health);
}
