/**
 * lib/support.ts — 고객 문의처 단일 출처
 *
 * 같은 값이 약관·처리방침·환불 페이지·결제 화면·푸터·알림 메시지에 흩어져 있었다.
 * 전용 문의 메일로 바꿀 때 한 곳만 고치면 되도록 여기로 모은다.
 *
 * ⚠️ 약관·개인정보처리방침에 적힌 문의처는 법정 고지 항목이다.
 * 값을 바꾸면 그 문서들의 표기도 함께 바뀌는지 확인할 것.
 */

/** 고객 문의 이메일 */
export const SUPPORT_EMAIL = "moondoor_main@naver.com";

/** 고객 문의 전화 */
export const SUPPORT_PHONE = "0502-1944-3249";

/** 환불 요청 페이지 경로 */
export const REFUND_PATH = "/refund";
