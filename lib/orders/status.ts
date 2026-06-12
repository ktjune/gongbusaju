/**
 * lib/orders/status.ts
 * 주문 상태 전이 머신 — 허용된 전이만 통과시킨다.
 *
 * paid → generating → review → published
 *                   ↘ failed (생성 오류)
 *          review → rejected → generating (재생성)
 */

import type { OrderStatus } from "./types";

/** 각 상태에서 전이 가능한 다음 상태 목록 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  paid: ["generating"],
  generating: ["review", "failed"],
  review: ["published", "rejected"],
  published: [], // 종료 상태
  rejected: ["generating"], // 재생성
  failed: ["generating"], // 재시도
};

/** from → to 전이가 허용되는지 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** 전이 검증 — 불가하면 에러 throw */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`잘못된 주문 상태 전이: ${from} → ${to}`);
  }
}

/** 종료 상태(더 이상 전이 없음) 여부 */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
