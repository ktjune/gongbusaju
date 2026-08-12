import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Order } from "../types";

// 포트원 취소 API는 호출 여부만 확인한다 (실제 네트워크 호출 금지)
const cancelPortOne = vi.hoisted(() => vi.fn());
vi.mock("../../payments/portone", () => ({
  cancelPortOnePayment: cancelPortOne,
}));

import { getOrderStore, InMemoryOrderStore } from "../store";
import { refundOrder } from "../refund";

function baseOrder(paymentKey: string | null): Omit<
  Order,
  "id" | "createdAt" | "updatedAt" | "generateAttempts"
> {
  return {
    tier: "basic",
    status: "paid",
    subjectId: "subj_1",
    reportId: null,
    userId: null,
    paymentKey,
    refundedAt: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRequestReason: null,
    notifyError: null,
    notifyFailedAt: null,
    contactEmail: "parent@example.com",
    contactPhone: null,
  };
}

describe("refundOrder — PG 분기", () => {
  let store: InMemoryOrderStore;

  beforeEach(() => {
    cancelPortOne.mockReset();
    cancelPortOne.mockResolvedValue({ cancellation: { status: "SUCCEEDED" } });
    store = getOrderStore() as InMemoryOrderStore;
  });

  afterEach(() => vi.clearAllMocks());

  it("모의결제(paymentKey 없음)는 PG를 호출하지 않고 전이한다", async () => {
    const o = await store.createOrder(baseOrder(null));
    const res = await refundOrder(o.id, "테스트");
    expect(res.status).toBe("refunded");
    expect(cancelPortOne).not.toHaveBeenCalled();
  });

  it("토스 테스트 결제(tgen_)는 PG를 호출하지 않고 전이한다 — 오갈 돈이 없다", async () => {
    const o = await store.createOrder(baseOrder("tgen_20260807175400xvGs6"));
    const res = await refundOrder(o.id, "테스트 결제 정리");
    expect(res.status).toBe("refunded");
    // 핵심 회귀 방지: 토스 키를 포트원에 보내면 PAYMENT_NOT_FOUND로 실패한다
    expect(cancelPortOne).not.toHaveBeenCalled();
  });

  it("포트원 결제(gbg_)는 포트원 취소 API를 호출한 뒤 전이한다", async () => {
    const o = await store.createOrder(baseOrder("gbg_0f9c1e2a3b4c5d6e7f80"));
    const res = await refundOrder(o.id, "고객 변심");
    expect(cancelPortOne).toHaveBeenCalledWith("gbg_0f9c1e2a3b4c5d6e7f80", "고객 변심");
    expect(res.status).toBe("refunded");
  });

  it("포트원 취소가 실패하면 주문을 전이시키지 않는다 — 돈은 그대로인데 환불됨 표시 방지", async () => {
    cancelPortOne.mockRejectedValue(new Error("포트원 결제 취소 실패 (ALREADY_CANCELLED)"));
    const o = await store.createOrder(baseOrder("gbg_aaaabbbbccccddddeeee"));

    await expect(refundOrder(o.id, "변심")).rejects.toThrow(/취소 실패/);

    const after = await store.getOrder(o.id);
    expect(after?.status).toBe("paid"); // 전이되지 않았다
    expect(after?.refundedAt).toBeNull();
  });

  it("토스 실결제는 자동 취소하지 않고 수동 처리를 요구한다", async () => {
    const o = await store.createOrder(baseOrder("tviva20260807120000abcd"));

    await expect(refundOrder(o.id, "변심")).rejects.toThrow(/토스 상점관리자/);

    expect(cancelPortOne).not.toHaveBeenCalled();
    const after = await store.getOrder(o.id);
    expect(after?.status).toBe("paid"); // 돈이 안 나갔으므로 환불됨 표시도 안 한다
  });

  it("이미 환불된 주문은 다시 환불할 수 없다", async () => {
    const o = await store.createOrder(baseOrder("gbg_1111222233334444aaaa"));
    await refundOrder(o.id, "1차");
    await expect(refundOrder(o.id, "2차")).rejects.toThrow(/상태 전이/);
  });

  it("사유를 비우면 기본 사유가 기록된다", async () => {
    const o = await store.createOrder(baseOrder(null));
    const res = await refundOrder(o.id, "   ");
    expect(res.refundReason).toBe("고객 요청 환불");
  });
});
