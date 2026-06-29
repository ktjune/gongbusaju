/**
 * POST /api/admin/refund — 주문 환불 처리
 * body: { orderId, reason? }
 *
 * 대상: paid(제작 착수 전) / rejected(반려됨) / failed(생성 오류) 주문만.
 * 실결제(paymentKey 있음)면 토스 결제취소 API를 호출해 검증 후 환불 처리한다.
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { refundOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { orderId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  if (!body.orderId) {
    return Response.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  try {
    const order = await refundOrder(body.orderId, body.reason);
    return Response.json({ orderId: order.id, status: order.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "환불 처리 실패";
    return Response.json({ error: msg }, { status: 400 });
  }
}
