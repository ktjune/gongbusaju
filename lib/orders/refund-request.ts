/**
 * lib/orders/refund-request.ts
 * 고객이 직접 접수하는 환불 요청 (이용약관 §7)
 *
 * 왜 필요한가: 신청은 비회원으로도 가능해서 마이페이지로 주문을 찾을 수 없다.
 * 그래서 결제한 고객이 환불을 요청할 창구가 전화·이메일밖에 없었다.
 * 여기서는 "주문번호 + 접수 시 입력한 연락처"로 본인을 확인하고 요청만 기록한다.
 *
 * 설계 원칙 — 요청과 실행을 분리한다:
 *   · 고객은 **요청**만 한다(refundRequestedAt 기록). 상태는 바뀌지 않는다.
 *   · 실제 환불(PG 결제취소 + status=refunded)은 운영자가 어드민에서 실행한다.
 * 자동 환불을 하지 않는 이유: 제작 착수 후 단순 변심은 약관상 환불 대상이
 * 아니어서(§7) 사람이 판단해야 하고, PG 취소는 되돌릴 수 없기 때문이다.
 */

import { getOrderStore } from "./store";
import type { Order } from "./types";

/** 환불 요청을 받을 수 없는 상태 — 이미 환불됐거나 요청이 무의미한 경우 */
const NOT_REQUESTABLE: Record<string, string> = {
  refunded: "이미 환불 처리된 주문입니다.",
};

export type RefundRequestInput = {
  orderId: string;
  /** 신청 시 입력한 이메일 또는 휴대폰 — 본인 확인용 */
  contact: string;
  reason: string;
};

export type RefundRequestResult = {
  orderId: string;
  status: Order["status"];
  refundRequestedAt: string | null;
};

/** 연락처 비교용 정규화 — 이메일은 소문자, 휴대폰은 숫자만 남긴다 */
export function normalizeContact(value: string): string {
  const v = value.trim();
  if (v.includes("@")) return v.toLowerCase();
  return v.replace(/\D/g, "");
}

/**
 * 주문의 저장된 연락처 중 하나와 일치하는지 확인한다.
 * 이메일·휴대폰 어느 쪽으로 신청했는지 고객이 기억하지 못해도 되도록 둘 다 본다.
 */
export function matchesContact(order: Order, input: string): boolean {
  const target = normalizeContact(input);
  if (!target) return false;
  return [order.contactEmail, order.contactPhone]
    .filter((c): c is string => !!c)
    .some((c) => normalizeContact(c) === target);
}

/**
 * 고객 환불 요청을 접수한다.
 *
 * @throws 주문이 없거나 · 연락처가 일치하지 않거나 · 이미 환불된 주문이면 Error
 *         (주문 없음과 연락처 불일치는 같은 메시지를 던진다 — 주문번호를
 *          넣어보며 남의 주문 존재 여부를 알아내는 것을 막기 위해)
 */
export async function submitRefundRequest(
  input: RefundRequestInput
): Promise<RefundRequestResult> {
  const orderId = input.orderId?.trim() ?? "";
  const contact = input.contact?.trim() ?? "";
  const reason = input.reason?.trim() ?? "";

  if (!orderId || !contact) {
    throw new Error("주문번호와 연락처를 모두 입력해 주세요.");
  }
  if (!reason) {
    throw new Error("환불 사유를 입력해 주세요.");
  }

  const store = getOrderStore();
  const order = await store.getOrder(orderId);

  // 주문 미존재와 연락처 불일치를 구분해서 알려주지 않는다(열거 공격 방지)
  if (!order || !matchesContact(order, contact)) {
    throw new Error("주문번호 또는 연락처가 일치하지 않습니다. 다시 확인해 주세요.");
  }

  const blocked = NOT_REQUESTABLE[order.status];
  if (blocked) throw new Error(blocked);

  const updated = await store.requestRefund(order.id, reason);

  return {
    orderId: updated.id,
    status: updated.status,
    refundRequestedAt: updated.refundRequestedAt,
  };
}
