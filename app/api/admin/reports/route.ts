/**
 * GET /api/admin/reports — 검수 대기 리포트 목록
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 * 리포트 본문은 자녀 PII 파생물이므로 middleware 인증 없이는 응답하지 않는다.
 */

import { listPendingReports } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET() {
  const reports = await listPendingReports();
  // 목록엔 본문(html/markdown) 제외 — 메타만
  const items = reports.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    token: r.token,
    tier: r.tier,
    reviewStatus: r.reviewStatus,
    createdAt: r.createdAt,
  }));
  return Response.json({ items });
}
