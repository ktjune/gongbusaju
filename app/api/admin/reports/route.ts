/**
 * GET /api/admin/reports — 검수 대기 리포트 목록
 *
 * [경고] 데모용 무인증. 리포트 본문은 자녀 PII 파생물이므로,
 * 프로덕션에서는 반드시 운영자 인증(세션/IP 제한)을 앞단에 둘 것.
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
