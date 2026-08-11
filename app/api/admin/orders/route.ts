/**
 * GET /api/admin/orders — 미완료 주문 목록 (재생성 대기 + 진행 중)
 *
 * rejected(반려됨) · failed(생성 오류) · paid(결제 직후) · generating(생성 중)를 반환한다.
 * paid/generating을 포함하는 이유: 이 둘은 어떤 어드민 화면에도 뜨지 않아
 * "결제는 됐는데 조회도 환불도 못 하는" 주문이 생겼다. 상태 머신은
 * paid → refunded 전이를 허용하므로 화면만 있으면 환불할 수 있다.
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { getOrderStore } from "@/lib/orders";
import { classifyPayment } from "@/lib/payments/classify";

export const runtime = "nodejs";

export async function GET() {
  const store = getOrderStore();
  const [rejected, failed, paid, generating] = await Promise.all([
    store.listOrders({ status: "rejected" }),
    store.listOrders({ status: "failed" }),
    store.listOrders({ status: "paid" }),
    store.listOrders({ status: "generating" }),
  ]);
  const items = [...rejected, ...failed, ...paid, ...generating]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => {
      const payment = classifyPayment(o.paymentKey);
      return {
        id: o.id,
        tier: o.tier,
        status: o.status,
        createdAt: o.createdAt,
        hasPayment: !!o.paymentKey,
        // 실제 출금이 있었을 수 있는 결제인지 — 환불 확인 문구를 여기서 분기한다
        paymentLabel: payment.label,
        paymentNeedsCare: payment.needsCare,
        // 고객이 /refund 로 접수한 환불 요청 (요청일 뿐 환불 완료가 아니다)
        refundRequestedAt: o.refundRequestedAt,
        refundRequestReason: o.refundRequestReason,
      };
    });
  return Response.json({ items });
}
