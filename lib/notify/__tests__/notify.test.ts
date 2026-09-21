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

  /**
   * 2026-09-16 사고 재현: 솔라피가 HTTP 200으로 응답해도 본문 statusCode가
   * "2000"이 아니면 접수가 거절된 것이다. 예전 코드는 res.ok만 보고 성공으로
   * 기록해, 고객에게 아무것도 안 갔는데 notifyError가 null로 남았다.
   */
  it("HTTP 200이어도 statusCode가 2000이 아니면 실패로 잡는다", async () => {
    stubSolapiEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "1010", statusMessage: "잔액이 부족합니다" }),
      })
    );

    const outcome = await sendResultLink({
      orderId: "ord5",
      resultUrl: "http://localhost/result/z",
      contactPhone: "010-1234-5678",
    });

    expect(outcome.hasFailure).toBe(true);
    expect(outcome.error).toContain("1010");

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("statusCode 2000이면 성공 — 발송 결과는 웹훅이 따로 확인한다", async () => {
    stubSolapiEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "2000", messageId: "M123" }),
      })
    );

    const outcome = await sendResultLink({
      orderId: "ord6",
      resultUrl: "http://localhost/result/z",
      contactPhone: "010-1234-5678",
    });

    expect(outcome.hasFailure).toBe(false);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("주문 식별자를 customFields에 실어 보낸다 — 발송 결과 웹훅이 주문을 찾는 유일한 단서", async () => {
    stubSolapiEnv();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ statusCode: "2000", messageId: "M123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendResultLink({
      orderId: "ord7",
      resultUrl: "http://localhost/result/z",
      contactPhone: "010-1234-5678",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message.customFields.orderId).toBe("ord7");
    // kind가 없으면 접수 확인 문자의 수신 보고가 결과 링크 도착으로 둔갑한다
    expect(body.message.customFields.kind).toBe("result-ata");

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe("알림톡 실패 시 문자 폴백", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("이메일 없는 고객 — 알림톡이 떨어지면 문자로 링크를 보내고 성공으로 본다", async () => {
    stubSolapiEnv();
    const fetchMock = vi
      .fn()
      // 1) 알림톡 접수 거절
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "3065", statusMessage: "알림톡 발송 불가" }),
      })
      // 2) 문자 폴백 접수 성공
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "2000", messageId: "M-LMS" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await sendResultLink({
      orderId: "ord8",
      resultUrl: "https://www.gongbusaju.kr/result/abc",
      contactPhone: "010-1234-5678",
    });

    expect(outcome.hasFailure).toBe(false);
    // 실패는 아니지만 기록은 남아야 한다 — 이게 없으면 뒤늦게 온 웹훅이 같은
    // 실패를 보고 문자를 한 통 더 보낸다(고객 중복 수신).
    expect(outcome.error).toContain("[자동복구]");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const lms = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(lms.message.type).toBe("LMS");
    // 문자는 템플릿 심사와 무관 — 링크를 프로토콜째 본문에 싣는다
    expect(lms.message.text).toContain("https://www.gongbusaju.kr/result/abc");
  });

  it("알림톡·문자 둘 다 실패하면 두 사유를 모두 남긴다", async () => {
    stubSolapiEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: "3065", statusMessage: "발송 불가" }),
      })
    );

    const outcome = await sendResultLink({
      orderId: "ord9",
      resultUrl: "https://www.gongbusaju.kr/result/abc",
      contactPhone: "010-1234-5678",
    });

    expect(outcome.hasFailure).toBe(true);
    expect(outcome.error).toContain("알림톡:");
    expect(outcome.error).toContain("문자 폴백:");
  });

  it("이메일이 있으면 문자를 겹쳐 보내지 않는다 — 알림톡 실패는 기록만", async () => {
    stubSolapiEnv();
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ statusCode: "3065", statusMessage: "발송 불가" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await sendResultLink({
      orderId: "ord10",
      resultUrl: "https://www.gongbusaju.kr/result/abc",
      contactEmail: "parent@example.com",
      contactPhone: "010-1234-5678",
    });

    // 알림톡 1회만 — 폴백 문자는 나가지 않는다
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.hasFailure).toBe(true);
    expect(outcome.error).not.toContain("문자 폴백");
  });
});

/** 알림톡 실발송 경로를 타게 하는 최소 환경 */
function stubSolapiEnv(): void {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SOLAPI_API_KEY", "k");
  vi.stubEnv("SOLAPI_API_SECRET", "s");
  vi.stubEnv("KAKAO_PF_ID", "pf");
  vi.stubEnv("KAKAO_TEMPLATE_ID", "tpl");
  vi.stubEnv("NOTIFY_FROM_PHONE", "01000000000");
}
