/**
 * lib/pdf — 리포트 HTML → PDF 변환
 *
 * 현재 상태: 스텁. 브라우저 인쇄(Ctrl+P) 방식만 지원.
 *   - 결과 페이지 HTML에 "PDF 저장 / 인쇄" 버튼이 이미 포함됨
 *   - 서버사이드 PDF는 @sparticuz/chromium (Vercel 호환) 적재 후 구현 예정
 *
 * [구현 예정]
 *   1. npm i @sparticuz/chromium puppeteer-core
 *   2. generatePdfFromHtml 내부에서 chromium.executablePath() + puppeteer.launch() 사용
 *   3. next.config.ts outputFileTracingIncludes에 chromium 바이너리 추가
 *   4. Vercel Pro 플랜 (메모리 1024MB 이상) 필요
 *
 * 현재: generatePdfFromHtml은 null 반환 (서버사이드 PDF 미지원 명시)
 *       pdfUrl = null → 리포트는 인쇄 버튼으로 PDF 저장
 */

/**
 * 리포트 HTML을 PDF Buffer로 변환한다.
 *
 * @returns PDF Buffer, 또는 null (서버사이드 PDF 미지원 시)
 * @throws 절대 throw 안 함 — 실패는 null 반환
 */
export async function generatePdfFromHtml(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _html: string
): Promise<Buffer | null> {
  // TODO: @sparticuz/chromium 설치 후 구현
  return null;
}

/**
 * Report.pdfUrl 저장 여부 판단.
 * generatePdfFromHtml이 null을 반환하면 pdfUrl은 null로 유지.
 */
export function isPdfSupported(): boolean {
  return false; // @sparticuz/chromium 미설치
}
