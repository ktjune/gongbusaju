/**
 * lib/validate/contact.ts
 * 연락처(이메일·휴대폰) 형식 검증 — 신청 폼(클라이언트)과 /api/order(서버)가 공유한다.
 * 리포트 링크가 잘못된 주소로 나가 전달 실패하는 것을 막기 위함.
 */

/** 전화번호에서 숫자만 남긴다 (하이픈·공백 제거). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 국내 휴대폰 번호 형식 검증. 숫자만 기준 010(11자리) / 011·016~019(10~11자리).
 * 예) "010-1234-5678" → true, "010-1234-567" → false
 */
export function isValidKoreanMobile(phone: string): boolean {
  return /^01[0-9]{8,9}$/.test(normalizePhone(phone));
}

/** 이메일 형식 검증 — local@domain.tld (tld 2자 이상). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
