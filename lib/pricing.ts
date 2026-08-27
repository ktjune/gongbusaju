/**
 * lib/pricing.ts — 리포트 가격 단일 출처 (서버·클라이언트 공용)
 *
 * 이 값이 세 곳에서 동시에 쓰인다:
 *   1. 신청 화면이 결제창에 넘기는 금액
 *   2. 서버가 PG 조회 결과와 대조하는 검증 기준 (lib/payments/portone)
 *   3. 결제완료 측정에 실리는 매출액 (lib/analytics)
 *
 * 셋이 어긋나면 결제가 "금액 불일치"로 거부되거나 매출 통계가 틀어진다.
 * 그래서 각자 상수를 두지 않고 여기 하나만 고친다.
 *
 * ⚠️ 이 파일은 클라이언트 번들에도 들어간다. 시크릿을 두지 말 것.
 * (lib/payments/portone.ts는 API 시크릿을 읽으므로 서버 전용 —
 *  클라이언트 컴포넌트에서 import 금지)
 */

/** 리포트 1부 가격 (원). 정가 29,000 → 할인가 9,900. */
export const REPORT_PRICE = 9900;

/** 화면 표시용 — "9,900" */
export const REPORT_PRICE_LABEL = REPORT_PRICE.toLocaleString("ko-KR");
