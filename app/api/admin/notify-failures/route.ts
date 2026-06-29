/**
 * GET /api/admin/notify-failures — 결과 링크 발송 실패 주문 목록
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { getOrderStore } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET() {
  const store = getOrderStore();
  const orders = await store.listNotifyFailures();
  const items = orders.map((o) => ({
    id: o.id,
    tier: o.tier,
    notifyError: o.notifyError,
    notifyFailedAt: o.notifyFailedAt,
  }));
  return Response.json({ items });
}
