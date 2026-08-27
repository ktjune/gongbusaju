import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOrderStore } from "../store";
import { matchesContact, normalizeContact, submitRefundRequest } from "../refund-request";
import type { Order } from "../types";

// getOrderStore()가 DATABASE_URL 없을 때 반환하는 인메모리 싱글턴을 그대로 쓴다
import { getOrderStore } from "../store";

function baseOrder(over: Partial<Order> = {}): Omit<
  Order,
  "id" | "createdAt" | "updatedAt" | "generateAttempts"
> {
  return {
    tier: "basic",
    status: "paid",
    subjectId: "subj_1",
    reportId: null,
    userId: null,
    paymentKey: "tgen_test",
    refundedAt: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRequestReason: null,
    notifyError: null,
    notifyFailedAt: null,
    buyerName: null,
    contactEmail: "Parent@Example.com",
    contactPhone: "010-1234-5678",
    ...over,
  };
}

describe("normalizeContact", () => {
  it("이메일은 소문자로, 휴대폰은 숫자만 남긴다", () => {
    expect(normalizeContact("  Parent@Example.COM ")).toBe("parent@example.com");
    expect(normalizeContact("010-1234-5678")).toBe("01012345678");
    expect(normalizeContact("010 1234 5678")).toBe("01012345678");
  });
});

describe("matchesContact", () => {
  const order = { contactEmail: "Parent@Example.com", contactPhone: "010-1234-5678" } as Order;

  it("이메일은 대소문자·공백을 무시하고 일치시킨다", () => {
    expect(matchesContact(order, "parent@example.com")).toBe(true);
    expect(matchesContact(order, " PARENT@EXAMPLE.COM ")).toBe(true);
  });

  it("휴대폰은 하이픈 유무와 무관하게 일치시킨다", () => {
    expect(matchesContact(order, "01012345678")).toBe(true);
    expect(matchesContact(order, "010-1234-5678")).toBe(true);
  });

  it("다른 연락처는 거부한다", () => {
    expect(matchesContact(order, "other@example.com")).toBe(false);
    expect(matchesContact(order, "01099998888")).toBe(false);
    expect(matchesContact(order, "")).toBe(false);
  });

  it("연락처가 하나만 저장돼 있어도 그쪽으로 확인된다", () => {
    const emailOnly = { contactEmail: "a@b.com", contactPhone: null } as Order;
    expect(matchesContact(emailOnly, "a@b.com")).toBe(true);
    expect(matchesContact(emailOnly, "01012345678")).toBe(false);
  });
});

describe("submitRefundRequest", () => {
  let store: InMemoryOrderStore;

  beforeEach(() => {
    store = getOrderStore() as InMemoryOrderStore;
  });

  it("주문번호와 연락처가 맞으면 요청을 기록한다 — 상태는 바뀌지 않는다", async () => {
    const order = await store.createOrder(baseOrder());

    const res = await submitRefundRequest({
      orderId: order.id,
      contact: "parent@example.com",
      reason: "생년월일을 잘못 입력했습니다",
    });

    expect(res.orderId).toBe(order.id);
    expect(res.refundRequestedAt).toBeTruthy();
    // 요청 ≠ 환불 — 실제 환불은 운영자가 실행한다
    expect(res.status).toBe("paid");

    const saved = await store.getOrder(order.id);
    expect(saved?.refundRequestReason).toBe("생년월일을 잘못 입력했습니다");
    expect(saved?.refundedAt).toBeNull();
  });

  it("연락처가 틀리면 거부한다", async () => {
    const order = await store.createOrder(baseOrder());
    await expect(
      submitRefundRequest({ orderId: order.id, contact: "wrong@example.com", reason: "변심" })
    ).rejects.toThrow(/일치하지 않습니다/);
  });

  it("없는 주문번호는 연락처 불일치와 같은 메시지를 낸다 (주문 존재 여부 노출 방지)", async () => {
    const order = await store.createOrder(baseOrder());

    const missing = await submitRefundRequest({
      orderId: "does-not-exist",
      contact: "parent@example.com",
      reason: "변심",
    }).catch((e: Error) => e.message);

    const wrongContact = await submitRefundRequest({
      orderId: order.id,
      contact: "wrong@example.com",
      reason: "변심",
    }).catch((e: Error) => e.message);

    expect(missing).toBe(wrongContact);
  });

  it("이미 환불된 주문은 다시 요청할 수 없다", async () => {
    const order = await store.createOrder(baseOrder());
    await store.refundOrder(order.id, "선처리");

    await expect(
      submitRefundRequest({ orderId: order.id, contact: "parent@example.com", reason: "변심" })
    ).rejects.toThrow(/이미 환불/);
  });

  it("사유가 비면 거부한다", async () => {
    const order = await store.createOrder(baseOrder());
    await expect(
      submitRefundRequest({ orderId: order.id, contact: "parent@example.com", reason: "   " })
    ).rejects.toThrow(/사유/);
  });

  it("발송 완료(published) 주문도 요청은 접수된다 — 하자·민원 처리용", async () => {
    const order = await store.createOrder(baseOrder({ status: "published" }));
    const res = await submitRefundRequest({
      orderId: order.id,
      contact: "010-1234-5678",
      reason: "내용이 신청과 다릅니다",
    });
    expect(res.status).toBe("published");
  });

  it("환불 요청 큐에는 미환불 요청만 뜬다", async () => {
    const a = await store.createOrder(baseOrder());
    const b = await store.createOrder(baseOrder());

    await submitRefundRequest({ orderId: a.id, contact: "parent@example.com", reason: "사유A" });
    await submitRefundRequest({ orderId: b.id, contact: "parent@example.com", reason: "사유B" });
    await store.refundOrder(b.id, "처리 완료");

    const queue = await store.listRefundRequests();
    const ids = queue.map((o) => o.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id); // 환불되면 큐에서 빠진다
  });
});
