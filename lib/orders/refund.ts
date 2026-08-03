/**
 * lib/orders/refund.ts
 * 환불 처리 (SPEC/이용약관 §7 — 제작 착수 전이거나 회사 귀책으로
 * 리포트가 제공되지 못한 경우 전액 환불)
 *
 * 대상: paid(제작 착수 전) / rejected·failed(회사 귀책으로 미제공) / published 주문.
 * 실결제(paymentKey 있음)면 포트원 결제취소 API를 먼저 호출해 성공한 뒤에만
 * 주문을 refunded로 전이한다. 모의 결제(PORTONE_API_SECRET 미설정 개발 환경)는
 * PG 호출 없이 상태만 전이한다.
 */

import { assertTransition } from "./status";
import { getOrderStore } from "./store";
import { cancelPortOnePayment } from "../payments/portone";
import type { Order } from "./types";

const DEFAULT_REASON = "고객 요청 환불";

/**
 * 주문을 환불 처리한다.
 *
 * @throws 허용되지 않는 상태 전이거나 PG 결제취소가 실패하면 Error
 */
export async function refundOrder(orderId: string, reason?: string): Promise<Order> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);

  assertTransition(order.status, "refunded");

  const cancelReason = reason?.trim() || DEFAULT_REASON;

  // paymentKey 컬럼에는 포트원 paymentId가 저장된다 (컬럼명은 하위호환 유지)
  if (order.paymentKey) {
    await cancelPortOnePayment(order.paymentKey, cancelReason);
  }
  // paymentKey 없음 = 모의 결제(개발 환경) — PG 호출 없이 상태만 전이

  return store.refundOrder(orderId, cancelReason);
}
