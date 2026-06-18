/**
 * POST /api/admin/review — 리포트 승인/반려
 * body: { reportId, action: "approve" | "reject", note? }
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { approveReport, rejectReport } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { reportId?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  if (!body.reportId || (body.action !== "approve" && body.action !== "reject")) {
    return Response.json(
      { error: "reportId와 action(approve|reject)이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const report =
      body.action === "approve"
        ? await approveReport(body.reportId)
        : await rejectReport(body.reportId, body.note ?? "");
    return Response.json({ reportId: report.id, reviewStatus: report.reviewStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "검수 처리 실패";
    return Response.json({ error: msg }, { status: 400 });
  }
}
