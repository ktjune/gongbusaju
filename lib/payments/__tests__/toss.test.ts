/**
 * lib/payments/toss.ts 테스트 — fetch를 mock해 실제 네트워크 호출 없이 검증.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { confirmTossPayment, cancelTossPayment, REPORT_PRICE } from "../toss";

const ORIGINAL_SECRET = process.env.TOSS_SECRET_KEY;

function mockFetchOnce(ok: boolean, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    })
  );
}

beforeEach(() => {
  process.env.TOSS_SECRET_KEY = "test-secret-key";
});

afterEach(() => {
  process.env.TOSS_SECRET_KEY = ORIGINAL_SECRET;
  vi.unstubAllGlobals();
});

describe("confirmTossPayment", () => {
  it("TOSS_SECRET_KEY 미설정 시 거부", async () => {
    delete process.env.TOSS_SECRET_KEY;
    await expect(
      confirmTossPayment({ paymentKey: "pk", orderId: "o1", amount: REPORT_PRICE })
    ).rejects.toThrow(/TOSS_SECRET_KEY/);
  });

  it("클라이언트가 보낸 금액이 정가와 다르면 토스 호출 없이 즉시 거부", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      confirmTossPayment({ paymentKey: "pk", orderId: "o1", amount: 1 })
    ).rejects.toThrow(/금액 불일치/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("토스가 비정상 응답(res.ok=false)이면 에러 메시지에 코드를 포함해 거부", async () => {
    mockFetchOnce(false, { code: "NOT_FOUND_PAYMENT", message: "결제 정보 없음" });
    await expect(
      confirmTossPayment({ paymentKey: "pk", orderId: "o1", amount: REPORT_PRICE })
    ).rejects.toThrow(/NOT_FOUND_PAYMENT/);
  });

  it("토스 응답 금액이 정가와 다르면 거부 (위변조 최종 방어)", async () => {
    mockFetchOnce(true, {
      paymentKey: "pk",
      orderId: "o1",
      status: "DONE",
      totalAmount: 1,
    });
    await expect(
      confirmTossPayment({ paymentKey: "pk", orderId: "o1", amount: REPORT_PRICE })
    ).rejects.toThrow(/승인 금액 불일치/);
  });

  it("status가 DONE이 아니면 거부", async () => {
    mockFetchOnce(true, {
      paymentKey: "pk",
      orderId: "o1",
      status: "READY",
      totalAmount: REPORT_PRICE,
    });
    await expect(
      confirmTossPayment({ paymentKey: "pk", orderId: "o1", amount: REPORT_PRICE })
    ).rejects.toThrow(/완료되지 않았습니다/);
  });

  it("정상 응답이면 결제 정보를 반환한다", async () => {
    mockFetchOnce(true, {
      paymentKey: "pk",
      orderId: "o1",
      status: "DONE",
      totalAmount: REPORT_PRICE,
      method: "카드",
    });
    const result = await confirmTossPayment({
      paymentKey: "pk",
      orderId: "o1",
      amount: REPORT_PRICE,
    });
    expect(result.status).toBe("DONE");
    expect(result.totalAmount).toBe(REPORT_PRICE);
  });
});

describe("cancelTossPayment", () => {
  it("TOSS_SECRET_KEY 미설정 시 거부", async () => {
    delete process.env.TOSS_SECRET_KEY;
    await expect(cancelTossPayment("pk", "고객 요청")).rejects.toThrow(/TOSS_SECRET_KEY/);
  });

  it("토스가 비정상 응답이면 에러 메시지에 코드를 포함해 거부", async () => {
    mockFetchOnce(false, { code: "ALREADY_CANCELED_PAYMENT", message: "이미 취소됨" });
    await expect(cancelTossPayment("pk", "고객 요청")).rejects.toThrow(
      /ALREADY_CANCELED_PAYMENT/
    );
  });

  it("정상 응답이면 취소 결과를 반환한다", async () => {
    mockFetchOnce(true, { paymentKey: "pk", status: "CANCELED" });
    const result = await cancelTossPayment("pk", "고객 요청");
    expect(result.status).toBe("CANCELED");
  });

  it("cancelReason을 요청 본문에 담아 보낸다", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ paymentKey: "pk", status: "CANCELED" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await cancelTossPayment("pk", "단순 변심");
    const [, options] = fetchSpy.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ cancelReason: "단순 변심" });
  });
});
