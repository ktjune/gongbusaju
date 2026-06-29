/**
 * lib/orders/refund.ts
 * 환불 처리 (SPEC/이용약관 §7 — 제작 착수 전이거나 회사 귀책으로
 * 리포트가 제공되지 못한 경우 전액 환불)
 *
 * 대상: paid(제작 착수 전) / rejected·failed(회사 귀책으로 미제공) 주문.
 * 실결제(paymentKey 있음)면 토스 결제취소 API를 먼저 호출해 검증한 뒤에만
 * 주문을 refunded로 전이한다. 모의 결제(TOSS_SECRET_KEY 미설정 개발 환경)는
 * 토스 호출 없이 상태만 전이한다.
 */

import { assertTransition } from "./status";
import { getOrderStore } from "./store";
import { cancelTossPayment } from "../payments/toss";
import type { Order } from "./types";

const DEFAULT_REASON = "고객 요청 환불";

/**
 * 주문을 환불 처리한다.
 *
 * @throws 허용되지 않는 상태 전이거나 토스 결제취소가 실패하면 Error
 */
export async function refundOrder(orderId: string, reason?: string): Promise<Order> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);

  assertTransition(order.status, "refunded");

  const cancelReason = reason?.trim() || DEFAULT_REASON;

  if (order.paymentKey) {
    await cancelTossPayment(order.paymentKey, cancelReason);
  }
  // paymentKey 없음 = 모의 결제(TOSS_SECRET_KEY 미설정 개발 환경) — 토스 호출 없이 상태만 전이

  return store.refundOrder(orderId, cancelReason);
}
