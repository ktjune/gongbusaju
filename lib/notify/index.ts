/**
 * lib/notify — 결과 링크 알림 발송
 *
 * 채널:
 *   - 이메일: Resend (RESEND_API_KEY 설정 시 실 발송)
 *   - 카카오 알림톡: Solapi REST API (SOLAPI_API_KEY 설정 시 실 발송)
 *       ※ 솔라피 템플릿의 "대체발송 설정"은 대체발송 안 함이다(콘솔에서 확인).
 *       즉 솔라피가 알아서 문자로 바꿔 보내주지 않는다. 그래서 이메일이 없는
 *       고객에 한해 **코드가 직접** LMS로 폴백한다(sendResultLms).
 *   - 발송 결과: HTTP 200은 "접수"일 뿐이다. 진짜 수신 여부는 솔라피 웹훅으로
 *       뒤늦게 오며, app/api/solapi-webhook 이 받아 주문에 기록한다.
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
 *   SOLAPI_WEBHOOK_SECRET — 발송 결과 웹훅 URL에 붙일 비밀값 (app/api/solapi-webhook)
 */

import { SUPPORT_EMAIL, SUPPORT_PHONE, REFUND_PATH } from "../support";

export type ResultLinkPayload = {
  orderId: string;
  /** 결과 페이지 전체 URL (https://gongbusaju.vercel.app/result/{token}) */
  resultUrl: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

/**
 * 자동으로 되살린 발송에 붙이는 표시.
 *
 * 두 가지를 동시에 한다.
 *   ① 같은 실패가 두 번 들어와도(솔라피 재전송 등) 문자를 두 번 보내지 않는 자물쇠.
 *   ② 어드민 "발송 실패" 큐에서 빼는 표시 — 고객은 이미 문자로 받았는데 큐에
 *      남아 있으면 운영자가 재발송을 눌러 **중복 발송**이 된다.
 * 사실 자체는 지워지지 않는다. 발송 완료 목록에 사유가 그대로 보인다.
 */
export const AUTO_RECOVERED_PREFIX = "[자동복구]";

/** 채널별 발송 결과 — 운영자가 어드민에서 실패 사유를 보고 재발송할 수 있게 한다. */
export type SendResultLinkOutcome = {
  /** 사람이 손대야 하는 실패가 있으면 true. 자동으로 되살린 건은 false. */
  hasFailure: boolean;
  /**
   * 기록할 사유. 전부 정상이면 null.
   * 자동 복구된 경우엔 hasFailure=false 이면서 AUTO_RECOVERED_PREFIX로 시작하는
   * 문구가 담긴다 — 호출측은 hasFailure와 무관하게 이 값을 그대로 저장해야 한다.
   */
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
  /** 사람 개입 없이 되살린 발송의 기록 — 실패는 아니지만 남겨야 한다. */
  let recovered: string | null = null;

  // 이메일 발송
  if (contactEmail) {
    await sendEmail(orderId, resultUrl, contactEmail).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify] 이메일 발송 실패 — 주문: ${orderId}`, err);
      errors.push(`이메일: ${msg}`);
    });
  }

  // 카카오 알림톡 (Solapi) — 실패하면 문자로 받아낸다
  if (contactPhone) {
    const alimtalkError = await sendAlimtalk(orderId, resultUrl, contactPhone).then(
      () => null,
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[notify] 알림톡 발송 실패 — 주문: ${orderId}`, err);
        return msg;
      }
    );

    if (alimtalkError !== null) {
      /*
       * 솔라피 템플릿의 대체발송이 "안 함"이라 알림톡이 떨어지면 고객에게
       * 아무것도 가지 않는다. 이메일도 없는 고객이면 그대로 미제공이 된다
       * (2026-09-16 주문). 돈을 받은 이상 침묵보다는 문자 한 통이 낫다.
       *
       * 이메일이 있는 고객에게까지 문자를 겹쳐 보내지는 않는다 — 이미 닿았고
       * 비용·성가심만 는다. 대신 알림톡 실패는 그대로 기록해 어드민에 남긴다.
       */
      if (contactEmail) {
        errors.push(`알림톡: ${alimtalkError}`);
      } else {
        const lmsError = await sendResultLms(orderId, resultUrl, contactPhone).then(
          () => null,
          (err: unknown) => (err instanceof Error ? err.message : String(err))
        );
        if (lmsError !== null) {
          console.error(`[notify] 결과 링크 문자 폴백도 실패 — 주문: ${orderId}`, lmsError);
          errors.push(`알림톡: ${alimtalkError} / 문자 폴백: ${lmsError}`);
        } else {
          console.warn(
            `[notify] 알림톡 실패 → 문자로 대체 발송 — 주문: ${orderId}, 사유: ${alimtalkError}`
          );
          recovered = `${AUTO_RECOVERED_PREFIX} 알림톡 실패(${alimtalkError}) → 문자 재발송함`;
        }
      }
    }
  }

  if (errors.length > 0) return { hasFailure: true, error: errors.join(" / ") };
  return { hasFailure: false, error: recovered };
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
    // 발송 결과 웹훅(app/api/resend-webhook)이 어느 주문의 무슨 메일인지
    // 알아보는 유일한 단서. Resend가 웹훅 페이로드에 그대로 돌려준다.
    tags: emailTags(orderId, "result-email"),
  });

  if (error) {
    throw new Error(`Resend 오류: ${error.message}`);
  }

  console.log(`[notify] 이메일 발송 완료 — 주문: ${orderId}, 수신: ${to}`);
}

/**
 * Resend 태그 — 솔라피의 customFields와 같은 역할(발송 결과 웹훅의 상관관계).
 *
 * 태그 값은 영숫자·밑줄·하이픈만 허용된다. 주문 식별자(cuid)는 영숫자라 그대로
 * 통과하지만, 혹시 모를 문자는 걸러 보낸다 — 태그 하나 때문에 메일 발송 전체가
 * 거부되면 본말전도다.
 */
export type EmailKind = "result-email" | "confirm-email";

function emailTags(orderId: string, kind: EmailKind): { name: string; value: string }[] {
  return [
    { name: "order_id", value: orderId.replace(/[^A-Za-z0-9_-]/g, "") },
    { name: "kind", value: kind },
  ];
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
 * 알림톡 전송이 실패하면(채널 미가입, 템플릿 미일치 등) 그대로 끝난다.
 * 솔라피 템플릿의 "대체발송 설정"이 대체발송 안 함이라 LMS 폴백은 일어나지
 * 않는다. 예전 주석은 폴백이 있다고 적어 두었으나 사실이 아니었다(2026-09-16 콘솔 확인).
 * 이 함수는 throw하므로, 호출측은 실패를 삼키지 말고 운영자 알림까지 올려야 한다.
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
 *
 * 버튼 구성 (2개 권장 — 받은 사람은 메시지를 길게 눌러 전달하지 않는다. 버튼만 쓴다):
 *   1) "리포트 확인하기"  → https://#{result_url}
 *   2) "공유하기"        → https://#{result_url}?share=1
 *      ?share=1로 들어오면 결과 페이지 맨 위에 공유 유도가 뜬다
 *      (app/(public)/result/[token]/route.ts). 브라우저가 사용자 제스처 없이
 *      navigator.share를 열어 주지 않으므로 자동 실행은 불가능하다.
 *   ※ 버튼 추가·문구 변경은 카카오 템플릿 재심사 대상이다(솔라피 콘솔에서 신청).
 *
 * 진행 상황(2026-09-16): 두 버튼을 넣은 사본 템플릿 리포트완성안내(공유버튼)을
 * 새로 등록해 카카오 검수를 요청했다 — 템플릿 코드 K1ukeX5bu1, 상태 검수진행중.
 * 운영 중인 단일 버튼 템플릿을 직접 고치면 재심사 동안 발송이 막힐 수 있어 사본으로 갔다.
 * 승인되면 KAKAO_TEMPLATE_ID를 새 코드로 바꾸고 재배포해야 반영된다.
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

  const accepted = await postSolapiMessage(orderId, "result-ata", apiKey, apiSecret, {
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
  });

  console.log(
    `[notify] 알림톡 접수 — 주문: ${orderId}, 수신: ${to}, messageId: ${accepted.messageId ?? "-"}`
  );
}

/**
 * 솔라피에 메시지 한 통을 접수시킨다 — 알림톡·LMS 공통 경로.
 *
 * **HTTP 200은 "접수"일 뿐 "발송 성공"이 아니다.** 솔라피는 접수 후 1차 검토를
 * 거쳐 카카오·이통사로 넘기고, 그 결과는 비동기로만 온다(발송 내역·웹훅).
 * 예전 코드는 `res.ok`만 보고 성공으로 기록했다 — 2026-09-16 주문(전화번호만 남긴
 * 고객)의 알림톡이 접수까지만 되고 사라졌는데 notifyError가 null로 남아,
 * 고객이 연락할 때까지 5일 동안 아무도 몰랐다.
 *
 * 그래서 여기서 두 겹으로 본다.
 *   ① HTTP 상태
 *   ② 응답 본문의 statusCode — "2000"(정상 접수)이 아니면 실패로 던진다.
 *      1xxx/3xxx는 접수 자체가 거절된 것이라 고객에게 아무것도 가지 않는다.
 * 그래도 남는 구멍(접수는 됐는데 카카오가 나중에 거절)은 웹훅이 메운다.
 *
 * customFields는 나중에 오는 발송 결과 웹훅이 어느 주문의 무슨 발송인지 알아보게
 * 하는 유일한 단서다 — 솔라피가 리포트에 그대로 돌려준다(app/api/solapi-webhook).
 * kind를 함께 싣는 이유: 접수 확인 문자와 결과 링크가 같은 주문 식별자를 쓰므로,
 * 접수 확인 문자의 수신 보고로 "결과 링크가 도착했다"고 적히면 안 된다.
 */
export type SolapiMessageKind = "result-ata" | "result-lms" | "confirm-lms";

type SolapiMessage = Record<string, unknown>;
type SolapiAccepted = { messageId: string | null; statusCode: string | null };

const SOLAPI_ACCEPTED_CODE = "2000";

async function postSolapiMessage(
  orderId: string,
  kind: SolapiMessageKind,
  apiKey: string,
  apiSecret: string,
  message: SolapiMessage
): Promise<SolapiAccepted> {
  const auth = await buildSolapiAuthAsync(apiKey, apiSecret);

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      message: { ...message, customFields: { orderId, kind } },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      `Solapi 오류 ${res.status}: ${data.errorCode ?? ""} ${data.errorMessage ?? ""}`.trim()
    );
  }

  // statusCode가 아예 없는 응답은 규격 변경일 수 있다 — 접수로 보고 웹훅에 맡긴다.
  const statusCode = typeof data.statusCode === "string" ? data.statusCode : null;
  if (statusCode !== null && statusCode !== SOLAPI_ACCEPTED_CODE) {
    throw new Error(
      `Solapi 접수 거절 ${statusCode}: ${data.statusMessage ?? ""}`.trim()
    );
  }

  return {
    messageId: typeof data.messageId === "string" ? data.messageId : null,
    statusCode,
  };
}

/**
 * 결과 링크를 문자(LMS)로 보낸다 — 알림톡이 실패했을 때의 폴백.
 *
 * 두 곳에서 부른다.
 *   ① sendResultLink — 알림톡 **접수**가 거절됐을 때, 그 자리에서 바로.
 *   ② app/api/solapi-webhook — 접수는 됐는데 **카카오가 뒤늦게 거절**했을 때.
 * ②가 없으면 9/16 같은 건은 사람이 어드민을 열어 눌러야 나간다.
 *
 * 알림톡보다 비싸지만(건당 30원대 vs 13원) 실패했을 때만 나간다.
 * 문자는 카카오 템플릿 심사와 무관해서 링크를 본문에 그대로 실을 수 있다.
 */
export async function sendResultLms(
  orderId: string,
  resultUrl: string,
  to: string
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[notify:dev] 결과 링크 문자 폴백 시뮬레이션\n  주문: ${orderId}\n  수신: ${to}\n  URL: ${resultUrl}`
    );
    return;
  }

  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.NOTIFY_FROM_PHONE;
  if (!apiKey || !apiSecret || !from) {
    throw new Error("Solapi 설정 미비 — 문자 폴백 불가");
  }

  const text =
    `[공부결] 리포트가 완성됐습니다\n\n` +
    `아래 링크에서 확인하세요.\n` +
    `${resultUrl}\n\n` +
    `링크는 언제든 다시 여실 수 있습니다.\n` +
    `문의: ${SUPPORT_PHONE} / ${SUPPORT_EMAIL}`;

  await postSolapiMessage(orderId, "result-lms", apiKey, apiSecret, {
    to: normalizePhone(to),
    from,
    type: "LMS",
    subject: "리포트 완성 안내",
    text,
  });
  console.log(`[notify] 결과 링크 문자 폴백 접수 — 주문: ${orderId}`);
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
export type OwnerAlertResult = { sent: boolean; error?: string };

export async function sendOwnerAlert(
  subject: string,
  body: string
): Promise<OwnerAlertResult> {
  const to = process.env.NOTIFY_OWNER_EMAIL?.trim();

  if (process.env.NODE_ENV !== "production") {
    console.log(`[notify:dev] 운영자 알림 시뮬레이션\n  제목: ${subject}\n  내용: ${body}`);
    return { sent: true };
  }
  if (!to) {
    console.warn(`[notify] NOTIFY_OWNER_EMAIL 미설정 — 운영자 알림 미발송: ${subject}`);
    return { sent: false, error: "NOTIFY_OWNER_EMAIL 미설정" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[notify] RESEND_API_KEY 미설정 — 운영자 알림 미발송: ${subject}`);
    return { sent: false, error: "RESEND_API_KEY 미설정" };
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
    return { sent: true };
  } catch (err) {
    // 삼키되 이유는 돌려준다 — 호출자가 로그·화면에 남길 수 있어야 한다.
    // 2026-09-16 주문에서 매출은 잡혔는데 알림 메일이 오지 않았고, 실패가
    // 어디에도 남지 않아 사후에 원인을 찾을 수 없었다.
    console.error(`[notify] 운영자 알림 발송 실패 — ${subject}`, err);
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
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
    tags: emailTags(orderId, "confirm-email"),
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

  const text =
    `[공부결] 신청이 접수됐습니다\n\n` +
    `주문번호: ${orderId}\n` +
    `상품: 공부결 리포트 1부 (9,900원)\n` +
    `제공: 결제 후 1일 이내\n\n` +
    `완성되면 결과 링크를 보내드립니다.\n` +
    `문의·환불: ${SUPPORT_PHONE} / ${SUPPORT_EMAIL}`;

  await postSolapiMessage(orderId, "confirm-lms", apiKey, apiSecret, {
    to: normalizePhone(to),
    from,
    type: "LMS",
    subject: "신청 접수 안내",
    text,
  });
  console.log(`[notify] 접수 확인 문자 접수 — 주문: ${orderId}`);
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
