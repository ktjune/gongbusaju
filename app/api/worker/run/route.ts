/**
 * GET /api/worker/run — paid 주문을 꺼내 백그라운드로 리포트 생성
 *
 * Vercel Cron이 1분마다 GET으로 호출한다 (vercel.json 참고).
 * waitUntil로 즉시 202를 반환하고, 생성(~40-50s)은 백그라운드에서 완료된다.
 *
 * 환경변수:
 *   CRON_SECRET — Vercel Cron 인증. 미설정 시 개발=통과, 프로덕션=거부.
 *
 * 보안:
 *   Vercel Cron은 자동으로 Authorization: Bearer {CRON_SECRET} 헤더를 붙인다.
 *   외부에서 임의 호출하면 주문 생성을 트리거할 수 없도록 검증한다.
 *
 * maxDuration:
 *   Vercel Pro = 300s, Hobby = 60s.
 *   waitUntil이 응답 후 남은 시간(≈ maxDuration - 응답시간)까지 실행되므로
 *   병렬 4그룹 ~40-50s가 60s 안에 들어온다.
 */

import { waitUntil } from "@vercel/functions";
import { getOrderStore, generateReportForOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro: 300s, Hobby: 60s (자동 상한)

export async function GET(req: Request) {
  // CRON_SECRET 검증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "인증 실패" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // 프로덕션에서 CRON_SECRET 미설정 → 503 (운영자 설정 오류 방지)
    return Response.json(
      { error: "CRON_SECRET 미설정 — Vercel env에 추가하세요." },
      { status: 503 }
    );
  }

  const store = getOrderStore();
  const paidOrders = await store.listOrders({ status: "paid" });

  if (paidOrders.length === 0) {
    return Response.json({ status: "idle", queued: 0 });
  }

  // FIFO: listOrders는 createdAt 내림차순 → 마지막 요소가 가장 오래된 주문
  const order = paidOrders[paidOrders.length - 1];

  waitUntil(
    generateReportForOrder(order.id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[worker] 생성 실패 — 주문: ${order.id}`, msg);
    })
  );

  console.log(`[worker] 생성 시작 (백그라운드) — 주문: ${order.id}, 대기 중: ${paidOrders.length}`);

  return Response.json(
    { status: "started", orderId: order.id, remaining: paidOrders.length - 1 },
    { status: 202 }
  );
}
