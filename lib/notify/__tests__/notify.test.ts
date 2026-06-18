import { describe, it, expect, vi, afterEach } from "vitest";
import { sendResultLink, buildResultUrl } from "../index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildResultUrl", () => {
  it("NEXT_PUBLIC_SITE_URL 미설정 → localhost 폴백", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    const url = buildResultUrl("abc123");
    expect(url).toBe("http://localhost:3000/result/abc123");
  });

  it("NEXT_PUBLIC_SITE_URL 설정 → 해당 URL 사용", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gongbusaju.vercel.app";
    const url = buildResultUrl("tok456");
    expect(url).toBe("https://gongbusaju.vercel.app/result/tok456");
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("VERCEL_URL 설정 → https:// 프리픽스 자동 추가", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "gongbusaju-abc.vercel.app";
    const url = buildResultUrl("tok789");
    expect(url).toBe("https://gongbusaju-abc.vercel.app/result/tok789");
    delete process.env.VERCEL_URL;
  });
});

describe("sendResultLink", () => {
  it("연락처 없으면 조용히 반환 (no throw)", async () => {
    await expect(
      sendResultLink({ orderId: "ord1", resultUrl: "http://localhost/result/x" })
    ).resolves.toBeUndefined();
  });

  it("개발 환경 + 이메일 있으면 console.log 호출", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendResultLink({
      orderId: "ord2",
      resultUrl: "http://localhost/result/y",
      contactEmail: "test@example.com",
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("ord2");
  });

  it("발송 실패해도 throw 안 함 (에러 격리)", async () => {
    // sendResultLink는 절대 throw 안 해야 한다
    await expect(
      sendResultLink({
        orderId: "ord3",
        resultUrl: "http://localhost/result/z",
        contactPhone: "010-1234-5678",
      })
    ).resolves.toBeUndefined();
  });
});
