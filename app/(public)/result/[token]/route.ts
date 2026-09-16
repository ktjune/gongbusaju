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
 * 저장된 HTML에 액션 버튼(PDF 저장 + 공유)과 전환 CTA를 주입한다.
 *
 * 공유는 **카카오 SDK를 쓰지 않는다.** 카카오 공유는 브라우저에 카카오 로그인이
 * 되어 있어야 해서, 카톡 밖(삼성인터넷 등)에서 누르면 로그인 화면이 떴다.
 * 어차피 나가는 건 링크 하나뿐이라 그만한 마찰을 감수할 이유가 없다.
 * 브라우저 기본 공유 시트(navigator.share)를 쓰면 카톡·문자·메모가 모두 나오고
 * 로그인도 필요 없다. 안 되는 환경에서는 링크 복사로 떨어진다.
 *
 * 버튼은 하단 고정 바 하나로 묶는다. 예전에는 리포트 템플릿의 "PDF 저장/인쇄"와
 * 여기서 주입한 "PDF 저장"이 각자 떠서 폰에서 겹쳐 보였다 — 템플릿 것은 숨긴다.
 */
function injectActionButtons(html: string, token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const resultUrl = `${siteUrl}/result/${token}`;
  const pdfHref = `/result/${token}/pdf`;

  const actionBar = `
<style>
  /* 템플릿 자체 인쇄 버튼은 숨긴다 — 아래 고정 바와 겹친다 */
  .print-btn { display: none !important; }
  .gb-actions {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 100;
    display: flex; gap: 8px; justify-content: center;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(255,255,255,0.94); backdrop-filter: blur(6px);
    border-top: 1px solid #e3ddd1;
    font-family: 'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  }
  .gb-actions > * {
    flex: 1 1 0; max-width: 220px; text-align: center;
    padding: 13px 10px; border-radius: 12px;
    font-size: 0.92rem; font-weight: 700; text-decoration: none;
    border: none; cursor: pointer; font-family: inherit;
  }
  .gb-pdf { background: #1f3b63; color: #fff; }
  .gb-share { background: #fff; color: #1f3b63; border: 1px solid #1f3b63 !important; }
  /* 고정 바에 본문 끝이 가리지 않도록 */
  body { padding-bottom: 88px; }
  @media print { .gb-actions { display: none !important; } body { padding-bottom: 0; } }
</style>
<div class="gb-actions">
  <a class="gb-pdf" href="${pdfHref}" download>PDF 저장</a>
  <button class="gb-share" type="button" onclick="gbShare()">공유하기</button>
</div>
<script>
  function gbShare() {
    var url = ${JSON.stringify(resultUrl)};
    var data = {
      title: '우리 아이 공부 기질 사주 리포트',
      text: '사주 명리 관점에서 본 공부 기질·학습 스타일·진로 경향 리포트입니다.',
      url: url
    };
    if (navigator.share) {
      navigator.share(data).catch(function (e) {
        if (e && e.name === 'AbortError') return;   // 사용자가 닫은 것 — 조용히 끝낸다
        gbCopy(url);
      });
      return;
    }
    gbCopy(url);
  }
  function gbCopy(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { alert('링크를 복사했어요. 원하는 곳에 붙여넣어 주세요.'); },
        function () { window.prompt('아래 링크를 복사해 주세요', url); }
      );
    } else {
      window.prompt('아래 링크를 복사해 주세요', url);
    }
  }
</script>`;

  // 공유받은 사람이 리포트를 다 보고 자연스럽게 신청/홈으로 넘어가도록 하는 전환 CTA.
  const ctaBanner = `
<div style="max-width:720px;margin:36px auto 24px;padding:0 20px;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="background:linear-gradient(135deg,#1f3b63,#2a5a9a);border-radius:20px;padding:40px 28px;text-align:center;color:#fff;box-shadow:0 12px 40px rgba(31,59,99,0.22);">
    <div style="font-size:1.35rem;font-weight:700;line-height:1.5;margin-bottom:12px;">우리 아이의 타고난 공부 결도<br>궁금하지 않으세요?</div>
    <div style="font-size:0.95rem;opacity:0.9;line-height:1.75;margin-bottom:26px;">생년월일시로 풀어낸 공부 기질·학습 스타일·진로 경향 리포트를<br>지금 <b style="color:#FEE500;">9,900원</b>에 받아보실 수 있어요.</div>
    <div>
      <a href="${siteUrl}/apply" style="display:inline-block;background:#FEE500;color:#191919;font-weight:700;font-size:1rem;padding:15px 32px;border-radius:12px;text-decoration:none;margin:0 4px 10px;">우리 아이 리포트 신청하기 →</a>
      <a href="${siteUrl}/" style="display:inline-block;color:#fff;font-weight:600;font-size:0.92rem;padding:15px 18px;text-decoration:underline;opacity:0.85;margin:0 4px;">공부결 둘러보기</a>
    </div>
  </div>
</div>`;

  const injection = ctaBanner + actionBar;
  return html.includes("</body>")
    ? html.replace("</body>", `${injection}
</body>`)
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
