/**
 * GET /api/admin/orders — 재생성 대기 주문 목록
 *
 * rejected(반려됨) + failed(생성 오류) 주문을 반환한다.
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { getOrderStore } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET() {
  const store = getOrderStore();
  const [rejected, failed] = await Promise.all([
    store.listOrders({ status: "rejected" }),
    store.listOrders({ status: "failed" }),
  ]);
  const items = [...rejected, ...failed]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => ({
      id: o.id,
      tier: o.tier,
      status: o.status,
      createdAt: o.createdAt,
      // 실결제 여부 — true면 환불 시 토스 결제취소 API 호출, false면 모의결제(상태만 전이)
      hasPayment: !!o.paymentKey,
    }));
  return Response.json({ items });
}
