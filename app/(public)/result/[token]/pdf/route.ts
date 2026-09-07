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
import { decryptPiiCompat } from "@/lib/crypto/pii";

/** 파일명에 못 쓰는 문자·경로 구분자를 걷어낸다. */
function safeFileWord(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]/g, "").slice(0, 20);
}

/**
 * 내려받을 파일 이름을 만든다.
 *
 * 기존에는 `report_7BBXVNuD.pdf`라 다운로드 폴더에서 무엇인지 알 수 없었다.
 * 브랜드(출처표시)는 "공부결"만 쓴다 — "공부사주"는 설명어 자리에만 (CLAUDE.md 규칙 #0).
 * 예) 공부결_리포트_준서_20260907.pdf
 */
function buildFileName(name: string | null, createdAtIso: string): string {
  const kst = new Date(new Date(createdAtIso).getTime() + 9 * 60 * 60 * 1000);
  const date = kst.toISOString().slice(0, 10).replace(/-/g, "");
  const who = name ? safeFileWord(name) : "";
  return ["공부결", "리포트", who, date].filter(Boolean).join("_") + ".pdf";
}

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

  // 아이 이름은 선택 입력이라 없을 수 있다 — 없으면 날짜만으로 짓는다.
  // 조회가 실패해도 PDF 다운로드 자체는 막지 않는다(파일명만 덜 친절해진다).
  let childName: string | null = null;
  try {
    const order = await store.getOrder(report.orderId);
    const subject = order ? await store.getSubject(order.subjectId) : null;
    childName = decryptPiiCompat(subject?.encName ?? null);
  } catch {
    /* 파일명 개인화 실패 — 기본 이름으로 계속 */
  }

  const fileName = buildFileName(childName, report.createdAt);
  // 한글 파일명은 filename*(RFC 5987)로 넘기고, 구형 클라이언트용 ASCII 이름을 함께 준다.
  const asciiFallback = `gongbugyeol_report_${report.createdAt.slice(0, 10).replace(/-/g, "")}.pdf`;

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
