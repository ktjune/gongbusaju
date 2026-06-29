/**
 * POST /api/admin/notify-retry — 결과 링크 재발송
 * body: { orderId }
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { retryNotify } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  if (!body.orderId) {
    return Response.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  try {
    const result = await retryNotify(body.orderId);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "재발송 실패";
    return Response.json({ error: msg }, { status: 400 });
  }
}
