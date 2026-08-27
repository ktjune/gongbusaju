/**
 * lib/analytics.ts — Google Analytics 4 (클라이언트 전용)
 *
 * 목적은 하나다: **광고비 대비 실제 결제가 얼마나 나오는지**를 재는 것.
 * 방문자 수만으로는 어떤 매체·어떤 문구가 팔았는지 알 수 없어 예산을 정할 수 없다.
 *
 * `NEXT_PUBLIC_GA_ID`가 없으면 스크립트를 아예 넣지 않는다(로컬 개발·미설정 환경).
 * 그래서 아래 함수들은 gtag이 없을 때 조용히 아무 것도 하지 않아야 한다 —
 * 측정 실패가 결제 흐름을 깨뜨리는 일은 절대 없어야 한다.
 */

/** 측정 ID. 미설정이면 GA를 로드하지 않는다. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

type GtagFn = (
  command: string,
  targetOrName: string,
  params?: Record<string, unknown>
) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === "function" ? g : null;
}

/**
 * 결제 완료를 기록한다 — GA4 표준 `purchase` 이벤트.
 *
 * 호출 시점이 중요하다: 결제창을 띄운 순간이 아니라 **주문이 실제로 만들어진 뒤**다.
 * (/api/order가 PG에 결제 내역을 조회·검증하고 200을 준 뒤)
 * 그래야 결제창만 열고 이탈한 사람이 매출로 잡히지 않는다.
 *
 * 개인정보는 보내지 않는다 — 주문번호·금액만. 이름·연락처·생년월일은 전송 금지.
 */
export function trackPurchase(orderId: string, amountKrw: number): void {
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag("event", "purchase", {
      transaction_id: orderId,
      value: amountKrw,
      currency: "KRW",
      items: [
        {
          item_id: "gongbugyeol_report",
          item_name: "공부결 리포트",
          price: amountKrw,
          quantity: 1,
        },
      ],
    });
  } catch {
    /* 측정 실패가 결제 흐름을 막지 않는다 */
  }
}

/**
 * 결제 시작(결제창 호출)을 기록한다 — GA4 표준 `begin_checkout`.
 * purchase와 함께 보면 "결제창까지 갔는데 안 산 비율"이 나온다.
 */
export function trackBeginCheckout(amountKrw: number): void {
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag("event", "begin_checkout", {
      value: amountKrw,
      currency: "KRW",
    });
  } catch {
    /* 무시 */
  }
}
