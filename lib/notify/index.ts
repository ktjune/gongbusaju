/**
 * lib/notify — 결과 링크 알림 발송
 *
 * 채널:
 *   - 이메일: Resend (RESEND_API_KEY 설정 시 실 발송)
 *   - 카카오 알림톡: Solapi REST API (SOLAPI_API_KEY 설정 시 실 발송)
 *       알림톡 실패 시 → LMS 문자(장문)로 자동 폴백
 *
 * 환경변수:
 *   RESEND_API_KEY        — Resend API 키
 *   NOTIFY_FROM_EMAIL     — 발신 주소 (기본: onboarding@resend.dev)
 *   NOTIFY_FROM_NAME      — 발신자 이름 (기본: 공부결)
 *   SOLAPI_API_KEY        — Solapi API 키
 *   SOLAPI_API_SECRET     — Solapi API 시크릿
 *   KAKAO_PF_ID           — 카카오 발신 프로필 ID (pfId, KA01PF…)
 *   KAKAO_TEMPLATE_ID     — 알림톡 템플릿 ID (templateId, KA01TP…)
 *   NOTIFY_FROM_PHONE     — 발신 전화번호 (Solapi 등록 번호, 예: 01012345678)
 */

import { SUPPORT_EMAIL, SUPPORT_PHONE, REFUND_PATH } from "../support";

export type ResultLinkPayload = {
  orderId: string;
  /** 결과 페이지 전체 URL (https://gongbusaju.vercel.app/result/{token}) */
  resultUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/** 채널별 발송 결과 — 운영자가 어드민에서 실패 사유를 보고 재발송할 수 있게 한다. */
export type SendResultLinkOutcome = {
  /** 시도한 채널 중 하나라도 실패하면 true */
  hasFailure: boolean;
  /** 실패 사유 (여러 채널 실패 시 " / "로 연결). 전부 성공·미시도면 null. */
  error: string | null;
};

/**
 * 리포트 결과 링크를 보호자에게 발송한다.
 *
 * 이메일 또는 전화번호 중 하나 이상이 있으면 발송 시도.
 * 둘 다 없으면 아무것도 하지 않는다 (에러 없이 조용히 반환).
 *
 * @throws 절대 throw 안 함 — 발송 실패는 결과 객체로 반환 (메인 플로우 차단 금지).
 */
export async function sendResultLink(
  payload: ResultLinkPayload
): Promise<SendResultLinkOutcome> {
  const { orderId, resultUrl, contactEmail, contactPhone } = payload;

  if (!contactEmail && !contactPhone) return { hasFailure: false, error: null };

  const errors: string[] = [];

  // 이메일 발송
  if (contactEmail) {
    await sendEmail(orderId, resultUrl, contactEmail).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] 이메일 발송 실패 — 주문: ${orderId}`, err);
      errors.push(`이메일: ${msg}`);
    });
  }

  // 카카오 알림톡 (Solapi)
  if (contactPhone) {
    await sendAlimtalk(orderId, resultUrl, contactPhone).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] 알림톡 발송 실패 — 주문: ${orderId}`, err);
      errors.push(`알림톡: ${msg}`);
    });
  }

  return errors.length > 0
    ? { hasFailure: true, error: errors.join(" / ") }
    : { hasFailure: false, error: null };
}

async function sendEmail(
  orderId: string,
  resultUrl: string,
  to: string
): Promise<void> {
  // 개발/테스트 환경에서는 콘솔만 (실수로 고객에게 발송 방지)
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[notify:dev] 이메일 발송 시뮬레이션\n  주문: ${orderId}\n  수신: ${to}\n  URL: ${resultUrl}`
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[notify] RESEND_API_KEY 미설정 — 이메일 미발송. 주문: ${orderId}`);
    return;
  }

  const from = buildFromAddress();
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "[공부결] 리포트가 완성됐습니다",
    html: buildEmailHtml(resultUrl),
  });

  if (error) {
    throw new Error(`Resend 오류: ${error.message}`);
  }

  console.log(`[notify] 이메일 발송 완료 — 주문: ${orderId}, 수신: ${to}`);
}

function buildFromAddress(): string {
  // 주의: ?? 가 아니라 빈 문자열까지 기본값으로 처리해야 한다.
  // 환경변수가 "" 로 설정되면 발신 주소가 "공부사주 <>" 가 돼 발송이 조용히 실패한다.
  const email = process.env.NOTIFY_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const name = process.env.NOTIFY_FROM_NAME?.trim() || "공부결";
  return `${name} <${email}>`;
}

function buildEmailHtml(resultUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf7f1;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(31,59,99,0.08);">
        <tr>
          <td style="background:#1f3b63;padding:28px 36px;">
            <h1 style="margin:0;color:#fff;font-size:1.3rem;font-weight:700;">공부결</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="margin:0 0 16px;color:#2c2c30;font-size:1rem;line-height:1.7;">
              안녕하세요.<br>
              신청하신 <strong>공부·진로 사주 리포트</strong>가 완성됐습니다.
            </p>
            <p style="margin:0 0 28px;color:#5a5f6a;font-size:0.9rem;line-height:1.7;">
              아래 버튼을 눌러 리포트를 확인하세요.<br>
              링크는 언제든지 다시 접속할 수 있습니다.
            </p>
            <a href="${resultUrl}"
               style="display:inline-block;background:#1f3b63;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:1rem;font-weight:600;">
              리포트 확인하기
            </a>
            <p style="margin:28px 0 0;color:#9a9fa8;font-size:0.8rem;line-height:1.6;">
              버튼이 작동하지 않으면 아래 주소를 브라우저에 직접 입력하세요.<br>
              <a href="${resultUrl}" style="color:#3b6fb5;word-break:break-all;">${resultUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f0e8;padding:16px 36px;color:#9a9fa8;font-size:0.78rem;line-height:1.6;">
            본 메일은 발신 전용입니다. 문의는 서비스 페이지를 이용해 주세요.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────
// 카카오 알림톡 (Solapi REST API)
// ──────────────────────────────────────────────────────────────

/**
 * 카카오 알림톡을 발송한다.
 *
 * 알림톡 전송 실패(채널 미가입, 템플릿 미일치 등) 시 Solapi가 자동으로
 * LMS(장문 문자)로 폴백한다 (Solapi 설정에 따름).
 *
 * 환경변수 미설정 시 콘솔 경고만 출력하고 정상 반환 (개발 환경).
 *
 * Solapi 알림톡 템플릿 등록 절차:
 *   1. https://console.solapi.com → 카카오채널 → 채널 연결
 *   2. 알림톡 템플릿 등록 → 내용 입력 → 카카오 심사 요청
 *   3. 승인 후 templateId(KA01TP…), pfId(KA01PF…) 확인
 *   4. 환경변수 KAKAO_TEMPLATE_ID, KAKAO_PF_ID 설정
 *
 * 권장 템플릿 내용 (#{result_url} 변수 포함):
 *   "안녕하세요.
 *   신청하신 공부·진로 사주 리포트가 완성됐습니다.
 *
 *   아래 링크에서 리포트를 확인하세요.
 *   #{result_url}
 *
 *   링크는 언제든 재접속할 수 있습니다."
 */
async function sendAlimtalk(
  orderId: string,
  resultUrl: string,
  to: string
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[notify:dev] 알림톡 발송 시뮬레이션\n  주문: ${orderId}\n  수신: ${to}\n  URL: ${resultUrl}`
    );
    return;
  }

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.KAKAO_PF_ID;
  const templateId = process.env.KAKAO_TEMPLATE_ID;
  const from = process.env.NOTIFY_FROM_PHONE;

  if (!apiKey || !apiSecret) {
    console.warn(
      `[notify] SOLAPI_API_KEY/SECRET 미설정 — 알림톡 미발송. 주문: ${orderId}, 전화: ${to}, URL: ${resultUrl}`
    );
    return;
  }
  if (!pfId || !templateId) {
    console.warn(
      `[notify] KAKAO_PF_ID/TEMPLATE_ID 미설정 — 알림톡 미발송. 주문: ${orderId}`
    );
    return;
  }
  if (!from) {
    console.warn(
      `[notify] NOTIFY_FROM_PHONE 미설정 — 알림톡 미발송. 주문: ${orderId}`
    );
    return;
  }

  const auth = await buildSolapiAuthAsync(apiKey, apiSecret);
  const body = {
    message: {
      to: normalizePhone(to),
      from,
      type: "ATA", // AlimTalk
      kakaoOptions: {
        pfId,
        templateId,
        variables: {
          // 템플릿의 본문·버튼 링크가 "https://#{result_url}" 형식이므로
          // 변수 값에는 프로토콜(https://)을 넣지 않는다 (중복 방지).
          "#{result_url}": resultUrl.replace(/^https?:\/\//, ""),
        },
      },
    },
  };

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      `Solapi 오류 ${res.status}: ${data.errorCode ?? ""} ${data.errorMessage ?? ""}`
    );
  }

  console.log(`[notify] 알림톡 발송 완료 — 주문: ${orderId}, 수신: ${to}`);
}

/**
 * Solapi HMAC-SHA256 인증 헤더를 생성한다.
 * 참고: https://docs.solapi.com/authentication/hmac
 */
async function buildSolapiAuthAsync(
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const data = date + salt;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `HMAC-SHA256 ApiKey=${apiKey}, Date=${date}, Salt=${salt}, Signature=${signature}`;
}

/**
 * 솔라피 잔액 조회 — 어드민 "비용" 섹션용 실측값.
 * 키 미설정·API 실패 시 null (호출자가 "조회 불가"로 표시).
 */
export async function getSolapiBalance(): Promise<{ balance: number; point: number } | null> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  try {
    const auth = await buildSolapiAuthAsync(apiKey, apiSecret);
    const res = await fetch("https://api.solapi.com/cash/v1/balance", {
      headers: { Authorization: auth },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { balance?: number; point?: number };
    return { balance: data.balance ?? 0, point: data.point ?? 0 };
  } catch {
    return null;
  }
}

/** 전화번호를 Solapi 형식(숫자만, 국내 010...)으로 정규화한다. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ──────────────────────────────────────────────────────────────
// 운영자 알림 — 자동화 예외(검수 대기·재시도 소진) 발생 시 푸시
// ──────────────────────────────────────────────────────────────

/**
 * 운영자(사장님)에게 예외 상황을 이메일로 알린다.
 *
 * 전체 자동화 원칙: 운영자는 어드민을 주기적으로 열어보지 않는다.
 * 사람 개입이 필요한 순간(검수 대기 발생, 재시도 소진)에만 이 알림이 간다.
 *
 * 환경변수: NOTIFY_OWNER_EMAIL — 미설정 시 경고만 남기고 건너뜀.
 * @throws 절대 throw 안 함 — 알림 실패가 메인 플로우를 막으면 안 된다.
 */
export async function sendOwnerAlert(subject: string, body: string): Promise<void> {
  const to = process.env.NOTIFY_OWNER_EMAIL?.trim();

  if (process.env.NODE_ENV !== "production") {
    console.log(`[notify:dev] 운영자 알림 시뮬레이션\n  제목: ${subject}\n  내용: ${body}`);
    return;
  }
  if (!to) {
    console.warn(`[notify] NOTIFY_OWNER_EMAIL 미설정 — 운영자 알림 미발송: ${subject}`);
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[notify] RESEND_API_KEY 미설정 — 운영자 알림 미발송: ${subject}`);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin`;
    const { error } = await resend.emails.send({
      from: buildFromAddress(),
      to,
      subject: `[공부결 운영] ${subject}`,
      html: `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7;color:#2c2c30;">
<p>${body.replace(/\n/g, "<br>")}</p>
<p><a href="${adminUrl}" style="color:#2a5a9a;font-weight:600;">어드민에서 확인하기 →</a></p>
</div>`,
    });
    if (error) throw new Error(error.message);
    console.log(`[notify] 운영자 알림 발송 — ${subject}`);
  } catch (err) {
    console.error(`[notify] 운영자 알림 발송 실패 — ${subject}`, err);
  }
}

/**
 * 결과 페이지 URL을 조합한다.
 *
 * NEXT_PUBLIC_SITE_URL 환경변수 → Vercel 자동 URL → 로컬 개발 순으로 폴백.
 */
export function buildResultUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base}/result/${token}`;
}

// ──────────────────────────────────────────────────────────────
// 주문 접수 확인
// ──────────────────────────────────────────────────────────────

export type OrderConfirmPayload = {
  orderId: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * 결제 직후 "신청이 접수됐습니다"를 보낸다.
 *
 * 왜 필요한가: 이게 없으면 고객은 결제 후 리포트가 나올 때까지(최대 1일)
 * 아무 연락도 못 받는다. 돈은 나갔는데 아무것도 안 오면 사기로 의심하게 되고,
 * 무엇보다 **환불 페이지에 필요한 주문번호를 알 방법이 없다**
 * (결제 완료 화면에만 뜨고, 창을 닫으면 사라진다).
 *
 * 전화번호만 있는 고객에게는 알림톡이 아니라 LMS로 보낸다. 알림톡은 카카오에
 * 심사받은 템플릿에만 실을 수 있는데 현재 승인된 템플릿은 "결과 링크" 하나뿐이다.
 * 접수 확인용 템플릿을 새로 등록하면 그때 알림톡으로 바꾸면 된다.
 *
 * @throws 절대 throw 안 함 — 발송 실패가 주문 생성을 되돌리면 안 된다.
 */
export async function sendOrderConfirm(
  payload: OrderConfirmPayload
): Promise<SendResultLinkOutcome> {
  const { orderId, contactEmail, contactPhone } = payload;
  if (!contactEmail && !contactPhone) return { hasFailure: false, error: null };

  const errors: string[] = [];

  if (contactEmail) {
    await sendOrderConfirmEmail(orderId, contactEmail).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] 접수 확인 이메일 실패 — 주문: ${orderId}`, err);
      errors.push(`이메일: ${msg}`);
    });
  }

  // 이메일이 있으면 문자까지 두 번 보내지 않는다(비용·성가심).
  if (contactPhone && !contactEmail) {
    await sendOrderConfirmLms(orderId, contactPhone).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] 접수 확인 문자 실패 — 주문: ${orderId}`, err);
      errors.push(`문자: ${msg}`);
    });
  }

  return errors.length > 0
    ? { hasFailure: true, error: errors.join(" / ") }
    : { hasFailure: false, error: null };
}

async function sendOrderConfirmEmail(orderId: string, to: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[notify:dev] 접수 확인 메일 시뮬레이션\n  주문: ${orderId}\n  수신: ${to}`);
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[notify] RESEND_API_KEY 미설정 — 접수 확인 미발송. 주문: ${orderId}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: buildFromAddress(),
    to,
    subject: "[공부결] 신청이 접수됐습니다",
    html: buildOrderConfirmHtml(orderId),
  });
  if (error) throw new Error(`Resend 오류: ${error.message}`);
  console.log(`[notify] 접수 확인 메일 완료 — 주문: ${orderId}`);
}

/** 전화번호만 남긴 고객용 — 알림톡 템플릿이 없으므로 LMS(장문 문자) */
async function sendOrderConfirmLms(orderId: string, to: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[notify:dev] 접수 확인 문자 시뮬레이션\n  주문: ${orderId}\n  수신: ${to}`);
    return;
  }
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.NOTIFY_FROM_PHONE;
  if (!apiKey || !apiSecret || !from) {
    console.warn(`[notify] Solapi 설정 미비 — 접수 확인 문자 미발송. 주문: ${orderId}`);
    return;
  }

  const auth = await buildSolapiAuthAsync(apiKey, apiSecret);
  const text =
    `[공부결] 신청이 접수됐습니다\n\n` +
    `주문번호: ${orderId}\n` +
    `상품: 공부결 리포트 1부 (9,900원)\n` +
    `제공: 결제 후 1일 이내\n\n` +
    `완성되면 결과 링크를 보내드립니다.\n` +
    `문의·환불: ${SUPPORT_PHONE} / ${SUPPORT_EMAIL}`;

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      message: { to: normalizePhone(to), from, type: "LMS", subject: "신청 접수 안내", text },
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Solapi 오류 ${res.status}: ${data.errorCode ?? ""} ${data.errorMessage ?? ""}`);
  }
  console.log(`[notify] 접수 확인 문자 완료 — 주문: ${orderId}`);
}

function buildOrderConfirmHtml(orderId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gongbusaju.kr";
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf7f1;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(31,59,99,0.08);">
        <tr><td style="background:#1f3b63;padding:28px 36px;">
          <h1 style="margin:0;color:#fff;font-size:1.3rem;font-weight:700;">공부결</h1>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 20px;color:#2c2c30;font-size:1rem;line-height:1.7;">
            안녕하세요.<br>신청과 결제가 <strong>정상 접수</strong>됐습니다.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f1;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
            <tr><td style="color:#5a5f6a;font-size:0.88rem;line-height:2;">
              <strong style="color:#2c2c30;">주문번호</strong> ${orderId}<br>
              <strong style="color:#2c2c30;">상품</strong> 공부결 리포트 1부 · 9,900원<br>
              <strong style="color:#2c2c30;">제공 기간</strong> 결제 후 1일(24시간) 이내
            </td></tr>
          </table>
          <p style="margin:0 0 24px;color:#5a5f6a;font-size:0.9rem;line-height:1.7;">
            리포트가 완성되면 결과 링크를 다시 보내드립니다.<br>
            <strong style="color:#2c2c30;">주문번호는 환불 요청 시 필요하니 이 메일을 보관해 주세요.</strong>
          </p>
          <p style="margin:0;color:#8a8f99;font-size:0.84rem;line-height:1.8;">
            취소·환불: 결제일부터 7일 이내, 리포트 제작 착수 전에는 전액 환불해 드립니다.<br>
            <a href="${siteUrl}${REFUND_PATH}" style="color:#1f3b63;">환불 신청 페이지</a>
            · ${SUPPORT_PHONE} · ${SUPPORT_EMAIL}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
