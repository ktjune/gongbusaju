import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyWebhook,
  extractWebhookHeaders,
  WebhookVerificationError,
  TOLERANCE_SECONDS,
} from "../webhook";

const SECRET = "whsec_" + Buffer.from("test-secret-key-bytes").toString("base64");
const NOW = 1_800_000_000;

function sign(payload: string, id: string, ts: number, secret = SECRET): string {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  return createHmac("sha256", key).update(`${id}.${ts}.${payload}`).digest("base64");
}

function headersFor(payload: string, id = "msg_1", ts = NOW) {
  return { id, timestamp: String(ts), signature: `v1,${sign(payload, id, ts)}` };
}

describe("verifyWebhook", () => {
  const payload = JSON.stringify({ type: "Transaction.Paid", data: { paymentId: "gbg_abc" } });

  it("올바른 서명은 통과한다", () => {
    expect(() => verifyWebhook(payload, headersFor(payload), SECRET, NOW)).not.toThrow();
  });

  it("본문이 한 글자만 달라도 거부한다", () => {
    const h = headersFor(payload);
    expect(() => verifyWebhook(payload + " ", h, SECRET, NOW)).toThrow(WebhookVerificationError);
  });

  it("다른 시크릿으로 만든 서명은 거부한다", () => {
    const other = "whsec_" + Buffer.from("attacker-key").toString("base64");
    const h = { id: "msg_1", timestamp: String(NOW), signature: `v1,${sign(payload, "msg_1", NOW, other)}` };
    expect(() => verifyWebhook(payload, h, SECRET, NOW)).toThrow(WebhookVerificationError);
  });

  it("헤더가 하나라도 없으면 거부한다", () => {
    const h = headersFor(payload);
    expect(() => verifyWebhook(payload, { ...h, id: null }, SECRET, NOW)).toThrow();
    expect(() => verifyWebhook(payload, { ...h, timestamp: null }, SECRET, NOW)).toThrow();
    expect(() => verifyWebhook(payload, { ...h, signature: null }, SECRET, NOW)).toThrow();
  });

  it("허용 범위를 벗어난 과거·미래 타임스탬프는 거부한다 (재전송 방지)", () => {
    const old = NOW - TOLERANCE_SECONDS - 1;
    expect(() => verifyWebhook(payload, headersFor(payload, "m", old), SECRET, NOW)).toThrow(
      WebhookVerificationError
    );
    const future = NOW + TOLERANCE_SECONDS + 1;
    expect(() => verifyWebhook(payload, headersFor(payload, "m", future), SECRET, NOW)).toThrow(
      WebhookVerificationError
    );
  });

  it("허용 범위 경계 안쪽은 통과한다", () => {
    const edge = NOW - TOLERANCE_SECONDS;
    expect(() =>
      verifyWebhook(payload, headersFor(payload, "m", edge), SECRET, NOW)
    ).not.toThrow();
  });

  it("서명이 여러 개면 하나만 맞아도 통과한다 (키 교체 대응)", () => {
    const good = sign(payload, "msg_1", NOW);
    const h = { id: "msg_1", timestamp: String(NOW), signature: `v1,bogussig v1,${good}` };
    expect(() => verifyWebhook(payload, h, SECRET, NOW)).not.toThrow();
  });

  it("타임스탬프가 숫자가 아니면 거부한다", () => {
    const h = { ...headersFor(payload), timestamp: "not-a-number" };
    expect(() => verifyWebhook(payload, h, SECRET, NOW)).toThrow(WebhookVerificationError);
  });
});

describe("extractWebhookHeaders", () => {
  it("Standard Webhooks 헤더 세 개를 읽는다", () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "webhook-id": "msg_1",
        "webhook-timestamp": "1800000000",
        "webhook-signature": "v1,abc",
      },
    });
    expect(extractWebhookHeaders(req)).toEqual({
      id: "msg_1",
      timestamp: "1800000000",
      signature: "v1,abc",
    });
  });
});
