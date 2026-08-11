/**
 * lib/payments/webhook.ts
 * 포트원 웹훅 서명 검증 — Standard Webhooks 스펙 (서버 전용)
 *
 * 포트원 V2 웹훅은 Standard Webhooks를 따른다. 헤더 세 개로 검증한다:
 *   webhook-id         — 메시지 고유 ID
 *   webhook-timestamp  — 유닉스 초. 너무 오래됐거나 미래면 거부(재전송 공격 방지)
 *   webhook-signature  — "v1,<base64>" 형식. 공백으로 구분된 여러 개일 수 있다
 *                        (키 교체 기간에 서명이 둘 이상 실림)
 *
 * 서명 대상 문자열은 `{id}.{timestamp}.{payload}` 이고, 키는 시크릿에서
 * `whsec_` 접두사를 뗀 뒤 base64 디코드한 바이트다.
 *
 * 직접 구현한 이유: @portone/server-sdk를 새로 들이지 않고도 node:crypto로
 * 충분히 검증 가능하며, 테스트로 고정해두는 편이 안전하기 때문이다.
 *
 * 환경변수: PORTONE_WEBHOOK_SECRET (포트원 콘솔에서 발급)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** 타임스탬프 허용 오차 — 포트원 기준과 동일하게 5분 */
export const TOLERANCE_SECONDS = 5 * 60;

const SECRET_PREFIX = "whsec_";

export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export class WebhookVerificationError extends Error {}

/** Request에서 Standard Webhooks 헤더 세 개를 뽑는다 */
export function extractWebhookHeaders(req: Request): WebhookHeaders {
  return {
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
  };
}

function secretKeyBytes(secret: string): Buffer {
  const raw = secret.startsWith(SECRET_PREFIX)
    ? secret.slice(SECRET_PREFIX.length)
    : secret;
  return Buffer.from(raw, "base64");
}

/** 길이가 달라도 타이밍 정보를 흘리지 않는 비교 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 웹훅 요청을 검증한다.
 *
 * @param payload 원본 요청 본문 **문자열**. 반드시 파싱 전 raw body여야 한다
 *                (JSON.parse 후 stringify하면 바이트가 달라져 서명이 깨진다)
 * @throws WebhookVerificationError 헤더 누락·시각 초과·서명 불일치
 */
export function verifyWebhook(
  payload: string,
  headers: WebhookHeaders,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): void {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature) {
    throw new WebhookVerificationError("웹훅 서명 헤더가 없습니다.");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new WebhookVerificationError("웹훅 타임스탬프 형식이 올바르지 않습니다.");
  }
  const drift = Math.abs(nowSeconds - ts);
  if (drift > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      `웹훅 타임스탬프 허용 범위를 벗어났습니다 (${drift}초 차이).`
    );
  }

  const expected = createHmac("sha256", secretKeyBytes(secret))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");

  // "v1,<sig> v1,<sig2>" — 하나라도 맞으면 통과 (키 교체 대응)
  const provided = signature
    .split(" ")
    .map((part) => {
      const comma = part.indexOf(",");
      return comma === -1 ? part : part.slice(comma + 1);
    })
    .filter(Boolean);

  if (!provided.some((sig) => safeEqual(sig, expected))) {
    throw new WebhookVerificationError("웹훅 서명이 일치하지 않습니다.");
  }
}
