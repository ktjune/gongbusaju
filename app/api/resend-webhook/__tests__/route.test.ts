/**
 * /api/resend-webhook — Resend 메일 발송 결과 수신
 *
 * 알림톡과 같은 구멍이 이메일에도 있다: send가 성공해도 그건 접수일 뿐이고,
 * 받는 쪽이 거부(bounce)하면 고객에게는 아무것도 닿지 않는다.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { InMemoryOrderStore, getOrderStore } from "@/lib/orders";
import type { OrderStore } from "@/lib/orders/store";

beforeEach(() => {
  (globalThis as unknown as { __orderStore?: unknown }).__orderStore =
    new InMemoryOrderStore();
});

async function publishedOrder(
  store: OrderStore,
  opts: { email?: string | null; phone?: string | null } = {}
): Promise<string> {
  const order = await store.createOrder({
    tier: "basic",
    status: "published",
    subjectId: "sub1",
    reportId: null,
    userId: null,
    paymentKey: null,
    refundedAt: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRequestReason: null,
    notifyError: null,
    notifyFailedAt: null,
    buyerName: null,
    contactEmail: opts.email === undefined ? "parent@example.com" : opts.email,
    contactPhone: opts.phone ?? null,
  });
  const report = await store.createReport({
    orderId: order.id,
    markdown: "#",
    html: "<p></p>",
    tier: "basic",
    reviewStatus: "approved",
    reviewNote: null,
    pdfUrl: null,
  });
  await store.setOrderReport(order.id, report.id);
  return order.id;
}

/** RESEND_WEBHOOK_SECRET 미설정 + 비프로덕션 → 서명 검증 생략 경로 */
function post(orderId: string, type: string, kind = "result-email"): Promise<Response> {
  return POST(
    new Request("https://x.test/api/resend-webhook", {
      method: "POST",
      body: JSON.stringify({
        type,
        data: { email_id: "E1", to: ["parent@example.com"], tags: { order_id: orderId, kind } },
      }),
    })
  );
}

describe("resend 발송 결과 웹훅", () => {
  it("email.delivered면 수신 확인 시각을 남긴다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post(id, "email.delivered");

    expect((await store.getOrder(id))!.notifyDeliveredAt).not.toBeNull();
  });

  it("email.sent 같은 중간 이벤트는 최종 결과가 아니라 무시한다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post(id, "email.sent");

    expect((await store.getOrder(id))!.notifyDeliveredAt).toBeNull();
  });

  it("반송되고 전화번호가 있으면 문자로 자동 재발송한다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: "010-1111-2222" });

    await post(id, "email.bounced");

    const order = (await store.getOrder(id))!;
    expect(order.notifyError).toContain("bounced");
    expect(order.notifyError).toContain("문자 재발송함");
  });

  it("반송됐는데 전화번호도 없으면 실패로 기록한다 — 자동으로 할 수 있는 게 없다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: null });

    await post(id, "email.bounced");

    const order = (await store.getOrder(id))!;
    expect(order.notifyError).toContain("bounced");
    expect(order.notifyError).not.toContain("문자 재발송함");
  });

  it("이미 다른 통로로 수신 확인된 주문은 반송이 와도 건드리지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: "010-1111-2222" });
    await store.recordNotifyDelivery(id, { deliveredAt: new Date(), error: null });

    await post(id, "email.bounced");

    const order = (await store.getOrder(id))!;
    expect(order.notifyDeliveredAt).not.toBeNull();
    expect(order.notifyError).toBeNull();
  });

  it("스팸 신고(email.complained)도 실패로 본다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: null });

    await post(id, "email.complained");

    expect((await store.getOrder(id))!.notifyError).toContain("complained");
  });

  it("접수 확인 메일(confirm-email)의 결과는 결과 링크 수신으로 치지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post(id, "email.delivered", "confirm-email");

    expect((await store.getOrder(id))!.notifyDeliveredAt).toBeNull();
  });

  it("서명 시크릿이 설정돼 있는데 헤더가 없으면 401", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_dGVzdHNlY3JldA==");
    const store = getOrderStore();
    const id = await publishedOrder(store);

    const res = await post(id, "email.delivered");

    expect(res.status).toBe(401);
    expect((await store.getOrder(id))!.notifyDeliveredAt).toBeNull();
    vi.unstubAllEnvs();
  });

  it("모르는 주문은 조용히 무시한다", async () => {
    const res = await post("없는주문", "email.delivered");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ applied: 0 });
  });
});
