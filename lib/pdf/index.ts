/**
 * lib/pdf — 리포트 HTML → PDF 변환
 *
 * Vercel 서버리스 환경: @sparticuz/chromium v149 + puppeteer-core v25
 *   - Vercel Hobby (1024MB) 에서 동작 (chromium ~400MB)
 *   - PDF 엔드포인트에 maxDuration=60 설정 필요
 *
 * 로컬(Windows): PUPPETEER_EXECUTABLE_PATH 환경변수로 Chrome 경로 지정
 *   예) PUPPETEER_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
 *   미지정 시 null 반환 — 브라우저 인쇄 버튼으로 대체
 */

/**
 * 리포트 HTML을 PDF Buffer로 변환한다.
 *
 * @returns PDF Uint8Array, 또는 null (생성 실패 시)
 */
export async function generatePdfFromHtml(
  html: string
): Promise<Uint8Array | null> {
  try {
    // 동적 import — 빌드 타임 번들 제외 (serverExternalPackages)
    const { default: Chromium } = await import("@sparticuz/chromium");
    const { default: puppeteer } = await import("puppeteer-core");

    // 로컬 Windows: PUPPETEER_EXECUTABLE_PATH 설정 필요
    // Vercel/Linux: Chromium.executablePath() 사용
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      (await Chromium.executablePath());

    if (!executablePath) return null;

    Chromium.setGraphicsMode = false; // WebGL 불필요 → 메모리 절약

    const browser = await puppeteer.launch({
      args: Chromium.args,
      executablePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdf = await page.pdf({
        format: "A4",
        margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
        printBackground: true,
      });

      return pdf;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

export function isPdfSupported(): boolean {
  return !!process.env.VERCEL || !!process.env.PUPPETEER_EXECUTABLE_PATH;
}
