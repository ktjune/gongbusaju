/**
 * GET /result/[token]
 * 토큰으로 발행된 리포트(디자인 HTML)를 표시한다.
 *
 * - 검수 통과(approved)분만 공개. 미검수는 "검수 중" 안내.
 * - ?preview=1 : 검수 전 미리보기 (개발·검수자용. 토큰을 아는 사람만 접근)
 * - 토큰은 추측 불가(randomBytes 24B base64url) — URL이 곧 접근 권한.
 *
 * Node 런타임 (fs·crypto 간접 사용).
 */

import { getOrderStore } from "@/lib/orders";

/**
 * 저장된 HTML에 PDF 다운로드 링크를 주입한다.
 * print-btn 옆에 별도 앵커 버튼으로 추가. CSS는 인라인 처리.
 */
function injectPdfButton(html: string, token: string): string {
  const pdfHref = `/result/${token}/pdf`;
  const btn = `<a href="${pdfHref}" download class="pdf-dl-btn" style="position:fixed;bottom:24px;right:190px;background:#2a5a9a;color:#fff;border-radius:50px;padding:12px 20px;font-size:0.88rem;font-weight:600;text-decoration:none;box-shadow:0 4px 16px rgba(31,59,99,0.25);z-index:100;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">⬇ PDF 저장</a>`;
  // </body> 직전에 삽입
  return html.includes("</body>")
    ? html.replace("</body>", `${btn}\n</body>`)
    : html + btn;
}

export const runtime = "nodejs";

const htmlResponse = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#faf7f1;color:#2c2c30;
display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;padding:24px}
.box{max-width:420px}.ico{font-size:2.4rem;margin-bottom:12px}h1{color:#1f3b63;font-size:1.4rem;margin:0 0 10px}
p{color:#5a5f6a;line-height:1.7}</style></head><body><div class="box">${body}</div></body></html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  const store = getOrderStore();
  const report = await store.getReportByToken(token);

  if (!report) {
    return htmlResponse(
      shell(
        "리포트를 찾을 수 없습니다",
        `<div class="ico">🔍</div><h1>리포트를 찾을 수 없습니다</h1>
         <p>링크가 올바른지 확인해 주세요. 링크는 발행 시 발급된 고유 주소입니다.</p>`
      ),
      404
    );
  }

  if (report.reviewStatus === "rejected") {
    return htmlResponse(
      shell(
        "리포트 재제작 중",
        `<div class="ico">🛠️</div><h1>리포트를 다시 만들고 있습니다</h1>
         <p>검수 과정에서 보완이 필요해 재제작 중입니다. 완료되면 다시 안내해 드립니다.</p>`
      )
    );
  }

  if (report.reviewStatus !== "approved" && !preview) {
    return htmlResponse(
      shell(
        "리포트 제작 중",
        `<div class="ico">⏳</div><h1>리포트를 제작하고 있습니다</h1>
         <p>사주 계산과 전문가 검수를 거쳐 완성됩니다.<br>완료되면 입력하신 연락처로 알려 드립니다.</p>`
      )
    );
  }

  // 발행분(또는 미리보기) — 저장된 디자인 HTML + PDF 다운로드 버튼 주입
  const html = injectPdfButton(report.html, token);
  return htmlResponse(html);
}
