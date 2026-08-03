/**
 * lib/payments/portone.ts 테스트 — fetch를 mock해 실제 네트워크 호출 없이 검증.
 *
 * 핵심 관심사: "결제되지 않았거나 금액이 다르면 절대 통과시키지 않는다".
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  verifyPortOnePayment,
  cancelPortOnePayment,
  newPaymentId,
  REPORT_PRICE,
} from "../portone";

const ORIGINAL_SECRET = process.env.PORTONE_API_SECRET;

/** fetch 응답 mock 헬퍼 */
function mockFetch(ok: boolean, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

const paidBody = (total = REPORT_PRICE) => ({
  id: "gbg_abc",
  status: "PAID",
  amount: { total },
});

beforeEach(() => {
  process.env.PORTONE_API_SECRET = "test-secret";
  vi.restoreAllMocks();
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.PORTONE_API_SECRET;
  else process.env.PORTONE_API_SECRET = ORIGINAL_SECRET;
});

describe("verifyPortOnePayment", () => {
  it("PORTONE_API_SECRET 미설정 시 거부", async () => {
    delete process.env.PORTONE_API_SECRET;
    await expect(verifyPortOnePayment("gbg_abc")).rejects.toThrow(/PORTONE_API_SECRET/);
  });

  it("paymentId가 비면 거부", async () => {
    await expect(verifyPortOnePayment("")).rejects.toThrow(/결제 정보/);
  });

  it("조회 실패(4xx) 시 거부", async () => {
    mockFetch(false, { type: "PAYMENT_NOT_FOUND", message: "없는 결제" });
    await expect(verifyPortOnePayment("gbg_abc")).rejects.toThrow(/결제 조회 실패/);
  });

  it("결제 미완료(PAID 아님) 시 거부 — 가상계좌 미입금 포함", async () => {
    mockFetch(true, { id: "gbg_abc", status: "VIRTUAL_ACCOUNT_ISSUED", amount: { total: REPORT_PRICE } });
    await expect(verifyPortOnePayment("gbg_abc")).rejects.toThrow(/완료되지 않았습니다/);
  });

  it("금액이 정가와 다르면 거부 (위변조 방지)", async () => {
    mockFetch(true, paidBody(100));
    await expect(verifyPortOnePayment("gbg_abc")).rejects.toThrow(/금액 불일치/);
  });

  it("정상 결제는 통과", async () => {
    mockFetch(true, paidBody());
    const p = await verifyPortOnePayment("gbg_abc");
    expect(p.status).toBe("PAID");
    expect(p.amount.total).toBe(REPORT_PRICE);
  });

  it("인증 헤더를 PortOne 형식으로 보낸다", async () => {
    mockFetch(true, paidBody());
    await verifyPortOnePayment("gbg_abc");
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("PortOne test-secret");
  });
});

describe("cancelPortOnePayment", () => {
  it("취소 실패 시 에러", async () => {
    mockFetch(false, { type: "PAYMENT_ALREADY_CANCELLED", message: "이미 취소됨" });
    await expect(cancelPortOnePayment("gbg_abc", "고객 요청")).rejects.toThrow(/결제 취소 실패/);
  });

  it("취소 사유를 본문에 담아 보낸다", async () => {
    mockFetch(true, { cancellation: { status: "SUCCEEDED" } });
    await cancelPortOnePayment("gbg_abc", "단순 변심");
    const [url, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/payments/gbg_abc/cancel");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "단순 변심" });
  });
});

describe("newPaymentId", () => {
  it("호출마다 고유한 값을 만든다", () => {
    expect(newPaymentId()).not.toBe(newPaymentId());
  });
});
