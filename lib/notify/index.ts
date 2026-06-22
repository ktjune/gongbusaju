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
 *   NOTIFY_FROM_NAME      — 발신자 이름 (기본: 공부사주)
 *   SOLAPI_API_KEY        — Solapi API 키
 *   SOLAPI_API_SECRET     — Solapi API 시크릿
 *   KAKAO_PF_ID           — 카카오 발신 프로필 ID (pfId, KA01PF…)
 *   KAKAO_TEMPLATE_ID     — 알림톡 템플릿 ID (templateId, KA01TP…)
 *   NOTIFY_FROM_PHONE     — 발신 전화번호 (Solapi 등록 번호, 예: 01012345678)
 */

export type ResultLinkPayload = {
  orderId: string;
  /** 결과 페이지 전체 URL (https://gongbusaju.vercel.app/result/{token}) */
  resultUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * 리포트 결과 링크를 보호자에게 발송한다.
 *
 * 이메일 또는 전화번호 중 하나 이상이 있으면 발송 시도.
 * 둘 다 없으면 아무것도 하지 않는다 (에러 없이 조용히 반환).
 *
 * @throws 절대 throw 안 함 — 발송 실패는 로그로만 처리 (메인 플로우 차단 금지).
 */
export async function sendResultLink(payload: ResultLinkPayload): Promise<void> {
  const { orderId, resultUrl, contactEmail, contactPhone } = payload;

  if (!contactEmail && !contactPhone) return;

  // 이메일 발송
  if (contactEmail) {
    await sendEmail(orderId, resultUrl, contactEmail).catch((err) => {
      console.error(`[notify] 이메일 발송 실패 — 주문: ${orderId}`, err);
    });
  }

  // 카카오 알림톡 (Solapi)
  if (contactPhone) {
    await sendAlimtalk(orderId, resultUrl, contactPhone).catch((err) => {
      console.error(`[notify] 알림톡 발송 실패 — 주문: ${orderId}`, err);
    });
  }
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
    subject: "[공부사주] 리포트가 완성됐습니다",
    html: buildEmailHtml(resultUrl),
  });

  if (error) {
    throw new Error(`Resend 오류: ${error.message}`);
  }

  console.log(`[notify] 이메일 발송 완료 — 주문: ${orderId}, 수신: ${to}`);
}

function buildFromAddress(): string {
  const email =
    process.env.NOTIFY_FROM_EMAIL ?? "onboarding@resend.dev";
  const name =
    process.env.NOTIFY_FROM_NAME ?? "공부사주";
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
            <h1 style="margin:0;color:#fff;font-size:1.3rem;font-weight:700;">공부사주</h1>
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
          "#{result_url}": resultUrl,
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

/** 전화번호를 Solapi 형식(숫자만, 국내 010...)으로 정규화한다. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
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
