/**
 * lib/auth/admin-session.ts 테스트
 */

import { describe, it, expect, vi } from "vitest";
import { createAdminSessionToken, verifyAdminSessionToken, safeCompare } from "../admin-session";

describe("createAdminSessionToken / verifyAdminSessionToken", () => {
  it("발급한 토큰은 같은 시크릿으로 검증 통과한다", async () => {
    const token = await createAdminSessionToken("secret123");
    expect(await verifyAdminSessionToken(token, "secret123")).toBe(true);
  });

  it("토큰에 비밀번호 원문이 들어있지 않다", async () => {
    const token = await createAdminSessionToken("super-secret-password");
    expect(token).not.toContain("super-secret-password");
  });

  it("다른 시크릿으로 검증하면 실패한다", async () => {
    const token = await createAdminSessionToken("secret123");
    expect(await verifyAdminSessionToken(token, "wrong-secret")).toBe(false);
  });

  it("토큰이 없으면 실패한다", async () => {
    expect(await verifyAdminSessionToken(undefined, "secret123")).toBe(false);
  });

  it("형식이 잘못된 토큰은 실패한다", async () => {
    expect(await verifyAdminSessionToken("garbage-no-dot", "secret123")).toBe(false);
  });

  it("서명이 조작된 토큰은 실패한다", async () => {
    const token = await createAdminSessionToken("secret123");
    const [payload] = token.split(".");
    expect(await verifyAdminSessionToken(`${payload}.tampered`, "secret123")).toBe(false);
  });

  it("만료된 토큰은 실패한다", async () => {
    vi.useFakeTimers();
    const token = await createAdminSessionToken("secret123");
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000); // 25시간 후 (TTL 24h 초과)
    expect(await verifyAdminSessionToken(token, "secret123")).toBe(false);
    vi.useRealTimers();
  });
});

describe("safeCompare", () => {
  it("같은 문자열은 true", async () => {
    expect(await safeCompare("hello", "hello")).toBe(true);
  });

  it("다른 문자열은 false", async () => {
    expect(await safeCompare("hello", "world")).toBe(false);
  });

  it("길이가 다른 문자열도 정확히 비교한다", async () => {
    expect(await safeCompare("short", "much-longer-string")).toBe(false);
  });
});
