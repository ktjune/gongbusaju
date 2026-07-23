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
import { getOrderStore, generateReportForOrder, MAX_GENERATE_ATTEMPTS } from "@/lib/orders";
import type { Order } from "@/lib/orders";

/** failed 재시도 대기시간 — 일시 장애(LLM 순단 등)가 걷힐 시간을 준다 */
const FAILED_RETRY_AFTER_MS = 15 * 60 * 1000;
/** generating 고착 판정 — 함수 상한(60s)을 한참 넘긴 상태는 타임아웃 사망으로 본다 */
const STUCK_GENERATING_AFTER_MS = 10 * 60 * 1000;

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

  // ── 1순위: 신규 결제 주문 (FIFO — listOrders는 내림차순이라 마지막이 가장 오래됨)
  let order: Order | undefined = paidOrders[paidOrders.length - 1];
  let kind = "paid";

  // ── 2순위: 자동 재시도 — failed(15분 경과) / 고착 generating(10분 경과),
  //    시도 상한(MAX_GENERATE_ATTEMPTS) 미만인 것만. 일시 장애를 사람 개입 없이 복구한다.
  if (!order) {
    const now = Date.now();
    const [failed, generating] = await Promise.all([
      store.listOrders({ status: "failed" }),
      store.listOrders({ status: "generating" }),
    ]);
    const retryable = [
      ...failed.filter(
        (o) => now - new Date(o.updatedAt).getTime() > FAILED_RETRY_AFTER_MS
      ),
      ...generating.filter(
        (o) => now - new Date(o.updatedAt).getTime() > STUCK_GENERATING_AFTER_MS
      ),
    ]
      .filter((o) => o.generateAttempts < MAX_GENERATE_ATTEMPTS)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // 오래된 것 먼저
    order = retryable[0];
    kind = "retry";
  }

  if (!order) {
    return Response.json({ status: "idle", queued: 0 });
  }

  const orderId = order.id;
  waitUntil(
    generateReportForOrder(orderId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[worker] 생성 실패 — 주문: ${orderId}`, msg);
    })
  );

  console.log(
    `[worker] 생성 시작 (${kind}, 시도 ${order.generateAttempts + 1}/${MAX_GENERATE_ATTEMPTS}) — 주문: ${orderId}, paid 대기: ${paidOrders.length}`
  );

  return Response.json(
    { status: "started", kind, orderId, remaining: Math.max(paidOrders.length - 1, 0) },
    { status: 202 }
  );
}
