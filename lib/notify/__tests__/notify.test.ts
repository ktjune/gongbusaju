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
  it("연락처 없으면 조용히 반환 (no throw) — 실패 없음으로 보고", async () => {
    const outcome = await sendResultLink({
      orderId: "ord1",
      resultUrl: "http://localhost/result/x",
    });
    expect(outcome).toEqual({ hasFailure: false, error: null });
  });

  it("개발 환경 + 이메일 있으면 console.log 호출, 실패 없음으로 보고", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const outcome = await sendResultLink({
      orderId: "ord2",
      resultUrl: "http://localhost/result/y",
      contactEmail: "test@example.com",
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("ord2");
    expect(outcome.hasFailure).toBe(false);
  });

  it("발송이 throw하지 않고 결과 객체로 안전하게 반환된다 (에러 격리)", async () => {
    const outcome = await sendResultLink({
      orderId: "ord3",
      resultUrl: "http://localhost/result/z",
      contactPhone: "010-1234-5678",
    });
    expect(outcome).toHaveProperty("hasFailure");
    expect(outcome).toHaveProperty("error");
  });

  it("프로덕션에서 알림톡 발송 실패 시 hasFailure=true + 사유를 채널명과 함께 반환", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SOLAPI_API_KEY", "k");
    vi.stubEnv("SOLAPI_API_SECRET", "s");
    vi.stubEnv("KAKAO_PF_ID", "pf");
    vi.stubEnv("KAKAO_TEMPLATE_ID", "tpl");
    vi.stubEnv("NOTIFY_FROM_PHONE", "01000000000");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ errorCode: "BadRequest", errorMessage: "잘못된 요청" }),
      })
    );

    const outcome = await sendResultLink({
      orderId: "ord4",
      resultUrl: "http://localhost/result/z",
      contactPhone: "010-1234-5678",
    });

    expect(outcome.hasFailure).toBe(true);
    expect(outcome.error).toContain("알림톡:");

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
