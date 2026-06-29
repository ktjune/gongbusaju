/**
 * GET /api/worker/cleanup-pii — 보관기간 만료 자녀 PII 삭제
 *
 * Vercel Cron이 매일 1회 호출한다 (vercel.json 참고).
 * Subject.retainUntil이 지난 행을 삭제한다. CLAUDE.md §8 — PII는
 * 법정대리인 동의 시 명시한 보관기간이 지나면 지체 없이 파기해야 한다.
 *
 * [주의] 주문에서 참조 중인 Subject도 삭제될 수 있다 — 주문 자체(Order)는
 * PII가 아니므로 남기고, 자녀 PII만 분리해서 지운다 (SPEC §6 데이터 모델).
 *
 * 환경변수:
 *   CRON_SECRET — Vercel Cron 인증. 미설정 시 개발=통과, 프로덕션=거부.
 */

import { getOrderStore } from "@/lib/orders";

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

  const store = getOrderStore();
  const deletedCount = await store.deleteExpiredSubjects(new Date().toISOString());

  console.log(`[worker:cleanup-pii] 보관기간 만료 PII 삭제: ${deletedCount}건`);

  return Response.json({ status: "done", deletedCount });
}
