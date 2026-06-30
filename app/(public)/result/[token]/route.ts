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

/** 저장된 HTML에 액션 버튼(PDF 저장 + 카카오톡 공유)을 주입한다. */
function injectActionButtons(html: string, token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const resultUrl = `${siteUrl}/result/${token}`;
  const pdfHref = `/result/${token}/pdf`;
  const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";

  const pdfBtn = `<a href="${pdfHref}" download class="pdf-dl-btn" style="position:fixed;bottom:24px;right:190px;background:#2a5a9a;color:#fff;border-radius:50px;padding:12px 20px;font-size:0.88rem;font-weight:600;text-decoration:none;box-shadow:0 4px 16px rgba(31,59,99,0.25);z-index:100;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">⬇ PDF 저장</a>`;

  const kakaoBtn = kakaoJsKey ? `
<button id="kakao-share-btn" onclick="shareKakao()" style="position:fixed;bottom:24px;right:340px;background:#FEE500;color:#191919;border:none;border-radius:50px;padding:12px 20px;font-size:0.88rem;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:100;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <svg width="18" height="18" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:4px"><path fill="#191919" d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.1 1.27 3.95 3.2 5.06L4 15l3.17-1.67c.59.1 1.2.17 1.83.17 4.14 0 7.5-2.69 7.5-6s-3.36-6-7.5-6z"/></svg>
  카카오톡 공유
</button>
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" crossorigin="anonymous"></script>
<script>
  Kakao.init('${kakaoJsKey}');
  function shareKakao() {
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '우리 아이 공부 기질 사주 리포트',
        description: '사주 명리 관점에서 분석한 공부 기질·학습 스타일·진로 경향 리포트입니다.',
        imageUrl: '${siteUrl}/og-image.png',
        link: { mobileWebUrl: '${resultUrl}', webUrl: '${resultUrl}' },
      },
      buttons: [{
        title: '리포트 확인하기',
        link: { mobileWebUrl: '${resultUrl}', webUrl: '${resultUrl}' },
      }],
    });
  }
</script>` : "";

  const injection = pdfBtn + kakaoBtn;
  return html.includes("</body>")
    ? html.replace("</body>", `${injection}\n</body>`)
    : html + injection;
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

  // 발행분(또는 미리보기) — 저장된 디자인 HTML + 액션 버튼 주입
  const html = injectActionButtons(report.html, token);
  return htmlResponse(html);
}
