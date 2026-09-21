/**
 * lib/orders/notify-audit — 수신 미확인 주문 경보
 *
 * 2026-09-16 사고의 마지막 안전망. 앞단이 다 새더라도 "돈은 받았는데 고객은
 * 못 받은" 상태가 조용히 남지 않아야 한다.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryOrderStore, getOrderStore } from "../index";
import { auditUnconfirmedNotifies } from "../notify-audit";
import type { OrderStore } from "../store";

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  (globalThis as unknown as { __orderStore?: unknown }).__orderStore =
    new InMemoryOrderStore();
});

/** 발행된 지 hoursAgo 시간 지난 주문 하나를 만든다. */
async function publishedOrder(
  store: OrderStore,
  opts: { hoursAgo: number; email?: string | null; phone?: string | null }
): Promise<string> {
  const order = await store.createOrder({
    tier: "basic",
    status: "published",
    subjectId: "sub1",
    reportId: "rep1",
    userId: null,
    paymentKey: null,
    refundedAt: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRequestReason: null,
    notifyError: null,
    notifyFailedAt: null,
    buyerName: null,
    contactEmail: opts.email ?? null,
    contactPhone: opts.phone ?? null,
  });
  // 인메모리 스토어는 updatedAt을 직접 주무를 방법이 없어 과거로 되돌려 둔다
  const aged = {
    ...(await store.getOrder(order.id))!,
    updatedAt: new Date(Date.now() - opts.hoursAgo * HOUR).toISOString(),
  };
  (store as unknown as { orders: Map<string, unknown> }).orders.set(order.id, aged);
  return order.id;
}

describe("auditUnconfirmedNotifies", () => {
  it("전화번호만 있는 고객의 수신 미확인 건을 잡아 운영자에게 알린다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 5, phone: "010-1111-2222" });

    const result = await auditUnconfirmedNotifies(3);

    expect(result.found).toBe(1);
    expect(result.orderIds).toEqual([id]);
  });

  it("이메일 고객도 대상이다 — Resend 웹훅이 수신을 확인해 주므로", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 5, email: "parent@example.com", phone: null });

    const result = await auditUnconfirmedNotifies(3);

    expect(result.orderIds).toEqual([id]);
  });

  it("연락처가 아예 없는 주문은 대상이 아니다 — 보낼 곳이 없었다", async () => {
    const store = getOrderStore();
    await publishedOrder(store, { hoursAgo: 5, email: null, phone: null });

    const result = await auditUnconfirmedNotifies(3);

    expect(result.found).toBe(0);
  });

  it("아직 기준 시간이 안 지난 건은 건드리지 않는다", async () => {
    const store = getOrderStore();
    await publishedOrder(store, { hoursAgo: 1, phone: "010-1111-2222" });

    const result = await auditUnconfirmedNotifies(3);

    expect(result.found).toBe(0);
  });

  it("웹훅이 수신 완료를 확인한 건은 대상이 아니다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 5, phone: "010-1111-2222" });
    await store.recordNotifyDelivery(id, { deliveredAt: new Date(), error: null });

    const result = await auditUnconfirmedNotifies(3);

    expect(result.found).toBe(0);
  });

  it("한 번 경보한 주문은 다시 울리지 않는다", async () => {
    const store = getOrderStore();
    await publishedOrder(store, { hoursAgo: 5, phone: "010-1111-2222" });

    const first = await auditUnconfirmedNotifies(3);
    const second = await auditUnconfirmedNotifies(3);

    expect(first.found).toBe(1);
    expect(second.found).toBe(0);
  });

  it("운영자 알림이 실패해도 표시는 남긴다 — 같은 건으로 매일 울리지 않게", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 5, phone: "010-1111-2222" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NOTIFY_OWNER_EMAIL", ""); // 미설정 → sendOwnerAlert가 sent:false

    const result = await auditUnconfirmedNotifies(3);

    expect(result.found).toBe(1);
    expect(result.alerted).toBe(0);
    expect((await store.getOrder(id))!.notifyAuditedAt).not.toBeNull();

    vi.unstubAllEnvs();
  });
});

/**
 * 재발송 뒤에도 감시가 살아 있어야 한다.
 *
 * 옛 수신 확인이 남아 있으면 이번 발송이 실패해도 웹훅과 감사가 모두
 * "이미 받았다"고 판단하고 넘어간다 — 9/16과 똑같은 침묵이 재발송에서 재현된다.
 */
describe("재발송하면 수신 확인을 처음부터 다시 센다", () => {
  it("recordNotifyResult는 옛 수신 확인·경보 표시를 지운다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 5, phone: "010-1111-2222" });
    await store.recordNotifyDelivery(id, { deliveredAt: new Date(), error: null });
    await auditUnconfirmedNotifies(3); // 대상 아님 — 이미 확인됨

    await store.recordNotifyResult(id, null); // 어드민에서 재발송

    const order = (await store.getOrder(id))!;
    expect(order.notifyDeliveredAt).toBeNull();
    expect(order.notifyAuditedAt).toBeNull();
  });

  it("자동 복구된 건은 어드민 '발송 실패' 큐에 뜨지 않는다 — 누르면 중복 발송", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { hoursAgo: 1, phone: "010-1111-2222" });
    await store.recordNotifyResult(id, "[자동복구] 알림톡 실패(3065) → 문자 재발송함");

    expect(await store.listNotifyFailures()).toHaveLength(0);

    await store.recordNotifyResult(id, "알림톡: 진짜 실패");
    expect(await store.listNotifyFailures()).toHaveLength(1);
  });
});
