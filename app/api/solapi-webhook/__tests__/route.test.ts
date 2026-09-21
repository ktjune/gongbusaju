/**
 * /api/solapi-webhook — 솔라피 발송 결과 수신
 *
 * 2026-09-16 사고의 핵심 구간: 접수는 됐는데 카카오가 뒤늦게 거절한 건.
 * 그때 (1) 실패로 기록되고 (2) 문자로 자동 재발송되는지를 고정한다.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "../route";
import { InMemoryOrderStore, getOrderStore } from "@/lib/orders";
import type { OrderStore } from "@/lib/orders/store";

beforeEach(() => {
  (globalThis as unknown as { __orderStore?: unknown }).__orderStore =
    new InMemoryOrderStore();
});

/** 발행 완료 주문 + 리포트 한 벌 */
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
    contactEmail: opts.email ?? null,
    contactPhone: opts.phone ?? "010-1111-2222",
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

function post(payload: unknown): Promise<Response> {
  return POST(
    new Request("https://x.test/api/solapi-webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

const report = (orderId: string, kind: string, statusCode: string) => ({
  messageId: "M1",
  statusCode,
  statusMessage: "테스트",
  customFields: { orderId, kind },
});

describe("solapi 발송 결과 웹훅", () => {
  it("4xxx(수신 완료)이면 수신 확인 시각을 남기고 실패 기록을 지운다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post([report(id, "result-ata", "4000")]);

    const order = (await store.getOrder(id))!;
    expect(order.notifyDeliveredAt).not.toBeNull();
    expect(order.notifyError).toBeNull();
  });

  it("2xxx(아직 접수 단계)는 최종 결과가 아니므로 건드리지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post([report(id, "result-ata", "2000")]);

    const order = (await store.getOrder(id))!;
    expect(order.notifyDeliveredAt).toBeNull();
    expect(order.notifyError).toBeNull();
  });

  it("카카오가 거절하면 문자로 자동 재발송하고 그 사실을 기록한다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: "010-1111-2222" });

    const res = await post([report(id, "result-ata", "3065")]);
    expect(res.status).toBe(200);

    const order = (await store.getOrder(id))!;
    expect(order.notifyError).toContain("3065");
    expect(order.notifyError).toContain("문자 재발송함");
    // 문자의 수신 보고를 아직 못 받았으므로 확인은 비어 있어야 한다
    expect(order.notifyDeliveredAt).toBeNull();
  });

  it("같은 리포트가 두 번 와도 문자를 두 번 보내지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await post([report(id, "result-ata", "3065")]);
    await post([report(id, "result-ata", "3065")]);

    const resent = spy.mock.calls.filter((c) =>
      String(c[0]).includes("문자로 재발송")
    );
    expect(resent).toHaveLength(1);
    spy.mockRestore();
  });

  it("문자(result-lms) 실패에는 또 문자를 보내지 않는다 — 무한 루프 방지", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post([report(id, "result-lms", "3065")]);

    const order = (await store.getOrder(id))!;
    expect(order.notifyError).toContain("3065");
    expect(order.notifyError).not.toContain("문자 재발송함");
  });

  it("이메일이 있는 고객에게는 문자를 겹쳐 보내지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { email: "parent@example.com" });

    await post([report(id, "result-ata", "3065")]);

    const order = (await store.getOrder(id))!;
    expect(order.notifyError).not.toContain("문자 재발송함");
  });

  it("접수 확인 문자(confirm-lms)의 결과는 결과 링크 수신으로 치지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post([report(id, "confirm-lms", "4000")]);

    expect((await store.getOrder(id))!.notifyDeliveredAt).toBeNull();
  });

  it("모르는 주문은 조용히 무시한다", async () => {
    const res = await post([report("없는주문", "result-ata", "4000")]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ applied: 0 });
  });

  it("단건 객체로 와도 받아준다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store);

    await post(report(id, "result-ata", "4000"));

    expect((await store.getOrder(id))!.notifyDeliveredAt).not.toBeNull();
  });
});

/**
 * 고객이 같은 안내를 두 번 받는 경로를 막는다.
 *
 * 접수 단계에서 이미 문자로 되살렸는데(lib/notify), 그 알림톡의 실패 보고가
 * 뒤늦게 웹훅으로 도착하는 경우가 있다. 여기서 또 문자를 보내면 중복이고,
 * 실패로 덮어쓰면 어드민 큐에 없는 일이 생겨 운영자가 재발송을 누른다.
 */
describe("이미 자동 복구된 주문", () => {
  it("뒤늦은 실패 보고가 와도 문자를 또 보내거나 기록을 덮지 않는다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: "010-1111-2222" });
    const recovered = "[자동복구] 알림톡 실패(1010) → 문자 재발송함";
    await store.recordNotifyResult(id, recovered);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await post([report(id, "result-ata", "3065")]);

    expect((await store.getOrder(id))!.notifyError).toBe(recovered);
    expect(
      spy.mock.calls.filter((c) => String(c[0]).includes("문자로 재발송"))
    ).toHaveLength(0);
    spy.mockRestore();
  });

  it("그 문자가 수신되면 자동 복구 기록이 지워진다", async () => {
    const store = getOrderStore();
    const id = await publishedOrder(store, { phone: "010-1111-2222" });
    await store.recordNotifyResult(id, "[자동복구] 알림톡 실패(1010) → 문자 재발송함");

    await post([report(id, "result-lms", "4000")]);

    const order = (await store.getOrder(id))!;
    expect(order.notifyDeliveredAt).not.toBeNull();
    expect(order.notifyError).toBeNull();
  });
});
