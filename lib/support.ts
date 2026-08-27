/**
 * lib/support.ts — 고객 문의처 단일 출처
 *
 * 같은 값이 약관·처리방침·환불 페이지·결제 화면·푸터·알림 메시지에 흩어져 있었다.
 * 전용 문의 메일로 바꿀 때 한 곳만 고치면 되도록 여기로 모은다.
 *
 * ⚠️ 약관·개인정보처리방침에 적힌 문의처는 법정 고지 항목이다.
 * 값을 바꾸면 그 문서들의 표기도 함께 바뀌는지 확인할 것.
 */

/** 고객 문의·환불 접수 이메일 (약관·환불·결제 화면·푸터) */
export const SUPPORT_EMAIL = "gongbusaju.refund@gmail.com";

/**
 * 개인정보 보호책임자 연락처 — 「개인정보 보호법」 제31조 법정 고지 항목.
 * 고객문의(환불) 주소와 일부러 분리한다. 개인정보 열람·삭제 요구가
 * 환불 문의함에 섞이면 법정 기한 내 처리를 놓치기 쉽다.
 */
export const PRIVACY_EMAIL = "moondoor_main@naver.com";

/** 고객 문의 전화 */
export const SUPPORT_PHONE = "0502-1944-3249";

/** 환불 요청 페이지 경로 */
export const REFUND_PATH = "/refund";
