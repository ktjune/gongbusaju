/**
 * GET /api/admin/refund-requests — 고객이 접수한 환불 요청 목록
 *
 * 고객은 /refund 에서 요청만 하고 상태는 바뀌지 않는다. 여기 뜬 주문을
 * 운영자가 검토해 환불(POST /api/admin/refund)하거나, 안내 후 그대로 둔다.
 * 환불이 실행되면(status=refunded) 목록에서 빠진다.
 *
 * 인증: middleware.ts — admin 세션
 */

import { getOrderStore } from "@/lib/orders";
import { classifyPayment } from "@/lib/payments/classify";

export const runtime = "nodejs";

export async function GET() {
  const store = getOrderStore();
  const orders = await store.listRefundRequests();

  const items = orders.map((o) => {
    const payment = classifyPayment(o.paymentKey);
    return {
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      refundRequestedAt: o.refundRequestedAt,
      refundRequestReason: o.refundRequestReason,
      buyerName: o.buyerName, // store가 복호화해서 반환 (PII — admin 전용)
      contactEmail: o.contactEmail, // store가 복호화해서 반환 (PII — admin 전용)
      contactPhone: o.contactPhone,
      paymentLabel: payment.label,
      paymentNeedsCare: payment.needsCare,
    };
  });

  return Response.json({ items });
}
