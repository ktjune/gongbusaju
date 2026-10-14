/**
 * GET /api/worker/ops-digest — 운영 요약 (운영 감시 에이전트용, 읽기 전용)
 *
 * 매일 아침 Claude 루틴이 호출해 결과를 드라이브에 기록하고,
 * ok=false일 때만 운영자에게 알린다. 판정 기준은 lib/orders/ops-digest 참고.
 *
 * 응답에는 개인정보가 없다(주문번호·상태·시각·건수·금액만).
 * ?llm=0 이면 LLM 공급자 점검을 건너뛴다(기본은 점검 — 비용은 사실상 0원).
 *
 * 환경변수:
 *   CRON_SECRET — Bearer 인증. 미설정 시 개발=통과, 프로덕션=거부.
 */

import { buildOpsDigest, withLlmAlerts } from "@/lib/orders/ops-digest";
import { checkLlmHealth } from "@/lib/report/llm-health";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "인증 실패" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "CRON_SECRET 미설정 — Vercel env에 추가하세요." },
      { status: 503 }
    );
  }

  const withLlm = new URL(req.url).searchParams.get("llm") !== "0";
  const [digest, llm] = await Promise.all([
    buildOpsDigest(),
    withLlm ? checkLlmHealth() : Promise.resolve(undefined),
  ]);

  const alerts = withLlmAlerts(digest.alerts, llm);

  return Response.json({
    ...digest,
    ok: alerts.length === 0,
    alerts,
    llm: llm ?? null,
  });
}
