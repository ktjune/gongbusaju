/**
 * lib/auth/admin-session.ts
 * 어드민 세션 토큰 — HMAC 서명. 비밀번호 원문을 쿠키에 담지 않는다.
 *
 * middleware.ts(기본 Edge 런타임)에서도 동작해야 하므로 Web Crypto API
 * (globalThis.crypto.subtle)만 사용한다 — node:crypto/Buffer는 Edge에서
 * 보장되지 않아 쓰지 않는다.
 *
 * 토큰 형식: "{만료시각(ms)}.{HMAC-SHA256(만료시각, ADMIN_PASSWORD)}"
 * (이전: 쿠키 값이 ADMIN_PASSWORD 원문 그대로였음 — 쿠키 유출 시 비밀번호 자체가
 * 노출되는 문제를 막기 위해 서명된 토큰으로 교체)
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h — 기존 쿠키 Max-Age와 동일
const enc = new TextEncoder();

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 길이가 같은 두 문자열을 상수 시간으로 비교한다 (타이밍 공격 완화). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(sig);
}

/** 로그인 성공 시 발급할 세션 토큰을 만든다. */
export async function createAdminSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${await hmacSign(payload, secret)}`;
}

/** 쿠키에서 받은 토큰이 유효한(서명 일치 + 만료 전) 세션인지 검증한다. */
export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = await hmacSign(payload, secret);
  return constantTimeEqual(sig, expected);
}

/** 두 문자열을 해시 후 상수 시간으로 비교한다 (평문 길이 비교로 인한 타이밍 누출 완화). */
export async function safeCompare(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return constantTimeEqual(toBase64Url(ha), toBase64Url(hb));
}
