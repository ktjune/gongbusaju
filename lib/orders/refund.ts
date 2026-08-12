/**
 * lib/orders/refund.ts
 * 환불 처리 (SPEC/이용약관 §7 — 제작 착수 전이거나 회사 귀책으로
 * 리포트가 제공되지 못한 경우 전액 환불)
 *
 * 대상: paid(제작 착수 전) / rejected·failed(회사 귀책으로 미제공) / published 주문.
 *
 * PG 분기가 필요한 이유: 2026-08 토스 직연동 → 포트원 전환 과정에서 paymentKey
 * 컬럼에 두 PG의 식별자가 섞였다. 컬럼명은 그대로 두고 값의 형식으로 구분한다
 * (lib/payments/classify). 토스 키를 포트원 API에 보내면 PAYMENT_NOT_FOUND로
 * 실패하므로, 어느 PG의 결제인지 먼저 판별한 뒤 호출한다.
 */

import { assertTransition } from "./status";
import { getOrderStore } from "./store";
import { cancelPortOnePayment } from "../payments/portone";
import { classifyPayment } from "../payments/classify";
import type { Order } from "./types";

const DEFAULT_REASON = "고객 요청 환불";

/**
 * 주문을 환불 처리한다.
 *
 * PG 호출 여부는 결제 성격에 따라 갈린다:
 *   none(모의결제) · test(PG 테스트 결제) → 실제 출금이 없으므로 상태만 전이
 *   portone                              → 포트원 결제취소 API 호출
 *   toss 실결제                          → 자동 취소하지 않고 에러. 토스 직연동은
 *                                          코드에서 제거됐으므로 운영자가 토스
 *                                          상점관리자에서 취소해야 한다.
 *
 * @throws 허용되지 않는 상태 전이거나 PG 결제취소가 실패하면 Error
 */
export async function refundOrder(orderId: string, reason?: string): Promise<Order> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);

  assertTransition(order.status, "refunded");

  const cancelReason = reason?.trim() || DEFAULT_REASON;
  const payment = classifyPayment(order.paymentKey);

  switch (payment.kind) {
    case "none":
    case "test":
      // 실제 출금이 없는 결제 — PG를 호출하지 않고 상태만 전이한다.
      // (PG 테스트 결제는 취소해도 오갈 돈이 없다)
      break;

    case "live":
    case "unknown":
      if (payment.provider === "portone") {
        await cancelPortOnePayment(order.paymentKey!, cancelReason);
        break;
      }
      // 토스 실결제 — 직연동 코드를 제거해 여기서 취소할 수단이 없다.
      // 상태만 refunded로 바꾸면 "환불됐다고 표시되는데 돈은 안 나간" 상태가
      // 되므로, 전이시키지 않고 운영자에게 수동 처리를 요구한다.
      throw new Error(
        `토스페이먼츠 결제(${order.paymentKey})는 자동 취소할 수 없습니다. ` +
          `토스 상점관리자에서 직접 결제를 취소한 뒤 처리해 주세요.`
      );
  }

  return store.refundOrder(orderId, cancelReason);
}
