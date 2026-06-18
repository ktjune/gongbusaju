/**
 * lib/notify — 결과 링크 알림 발송
 *
 * 실제 발송 채널 (API 키 설정 후 구현):
 *   - 이메일: SendGrid / SMTP
 *   - 카카오 알림톡: 카카오 비즈니스 채널
 *   - SMS: 국내 SMS API
 *
 * 현재 상태: 콘솔 스텁 (API 키 없음).
 *   - NODE_ENV=development: 발송 내용을 콘솔에 출력
 *   - NODE_ENV=production: 경고 로그만 (발송 미시도)
 *
 * [키 설정 후 할 일]
 *   1. .env.local에 KAKAO_ALIMTALK_KEY / SENDGRID_KEY 추가
 *   2. sendResultLink 내부에 실 발송 로직 구현
 *   3. 이 주석 제거
 */

export type ResultLinkPayload = {
  orderId: string;
  /** 결과 페이지 전체 URL (https://gongbusaju.vercel.app/result/{token}) */
  resultUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * 리포트 결과 링크를 보호자에게 발송한다.
 *
 * 이메일 또는 전화번호 중 하나 이상이 있으면 발송 시도.
 * 둘 다 없으면 아무것도 하지 않는다 (에러 없이 조용히 반환).
 *
 * @throws 절대 throw 안 함 — 발송 실패는 로그로만 처리 (메인 플로우 차단 금지).
 */
export async function sendResultLink(payload: ResultLinkPayload): Promise<void> {
  const { orderId, resultUrl, contactEmail, contactPhone } = payload;

  if (!contactEmail && !contactPhone) return;

  const target = [contactEmail, contactPhone].filter(Boolean).join(", ");

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[notify:dev] 결과 링크 발송 (스텁)\n  주문: ${orderId}\n  수신: ${target}\n  URL: ${resultUrl}`
    );
    return;
  }

  // 프로덕션: API 키 미설정 → 경고만
  console.warn(
    `[notify] 알림 발송 미구현 — 수동 전달 필요. 주문: ${orderId}, 수신: ${target}, URL: ${resultUrl}`
  );
}

/**
 * 결과 페이지 URL을 조합한다.
 *
 * NEXT_PUBLIC_SITE_URL 환경변수 → Vercel 자동 URL → 로컬 개발 순으로 폴백.
 */
export function buildResultUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}/result/${token}`;
}
