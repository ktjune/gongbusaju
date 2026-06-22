/**
 * GET /result/[token]/pdf
 * 발행된 리포트를 PDF로 생성·스트리밍한다.
 *
 * - 검수 통과(approved)분만 허용
 * - PDF 생성에 최대 60초 허용 (Vercel maxDuration)
 * - 생성 실패(로컬 chromium 미설치 등) 시 302로 원본 HTML 페이지로 리다이렉트
 *
 * Node 런타임 필수 (@sparticuz/chromium).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { getOrderStore } from "@/lib/orders";
import { generatePdfFromHtml } from "@/lib/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const store = getOrderStore();
  const report = await store.getReportByToken(token);

  if (!report || report.reviewStatus !== "approved") {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await generatePdfFromHtml(report.html);

  if (!pdf) {
    // PDF 생성 불가(로컬 개발 등) → 원본 HTML 페이지로 이동 (인쇄 버튼 사용)
    return Response.redirect(
      new URL(`/result/${token}`, _req.url).toString(),
      302
    );
  }

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report_${token.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
