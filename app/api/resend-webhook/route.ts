/**
 * POST /api/resend-webhook — Resend 메일 발송 결과 수신
 *
 * 왜 필요한가: `resend.emails.send`가 성공으로 답해도 그건 **접수**일 뿐이다.
 * 받는 쪽 메일 서버가 거부(bounce)하거나 스팸으로 분류하면 고객에게는
 * 아무것도 닿지 않는데, 우리 기록에는 성공으로 남는다. 알림톡에서 똑같은
 * 구조로 당한 게 2026-09-16 주문이다 — 이메일 쪽에도 같은 눈을 달아 둔다.
 *
 * 어느 주문인지는 발송할 때 실어 보낸 태그로 안다(lib/notify).
 *   order_id — 주문 식별자
 *   kind     — "result-email" | "confirm-email"
 * 접수 확인 메일(confirm-email)은 결과 링크가 아니므로 수신 여부에 반영하지 않는다.
 *
 * 인증: Resend 웹훅은 Standard Webhooks(Svix) 서명을 쓴다 — 포트원 웹훅과 같은
 * 스펙이라 lib/payments/webhook의 검증기를 그대로 재사용한다. 헤더 이름만
 * svix-* 와 webhook-* 두 갈래라 둘 다 받는다.
 *
 * 환경변수: RESEND_WEBHOOK_SECRET (Resend 대시보드 → Webhooks에서 발급, whsec_…)
 *
 * 응답은 항상 200 — 우리 사정으로 Resend가 재전송을 반복할 이유가 없다.
 */

import { getOrderStore } from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { sendOwnerAlert, sendResultLms, buildResultUrl, AUTO_RECOVERED_PREFIX } from "@/lib/notify";
import { verifyWebhook, WebhookVerificationError } from "@/lib/payments/webhook";
import type { WebhookHeaders } from "@/lib/payments/webhook";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Resend는 svix-* 로 보내고, Standard Webhooks 별칭(webhook-*)도 쓴다. */
function extractHeaders(req: Request): WebhookHeaders {
  const get = (svix: string, std: string) =>
    req.headers.get(svix) ?? req.headers.get(std);
  return {
    id: get("svix-id", "webhook-id"),
    timestamp: get("svix-timestamp", "webhook-timestamp"),
    signature: get("svix-signature", "webhook-signature"),
  };
}

type ResendEvent = {
  type?: unknown;
  data?: {
    email_id?: unknown;
    to?: unknown;
    tags?: unknown;
  };
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function POST(req: Request) {
  // 서명 검증은 **파싱 전 raw body**로 해야 한다 (JSON.parse 후 다시 문자열로
  // 만들면 바이트가 달라져 서명이 깨진다).
  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    try {
      verifyWebhook(raw, extractHeaders(req), secret);
    } catch (e) {
      const msg = e instanceof WebhookVerificationError ? e.message : String(e);
      console.warn(`[resend-webhook] 서명 검증 실패 — 무시: ${msg}`);
      return Response.json({ error: "서명 검증 실패" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET 미설정 — 수신 거부");
    return Response.json({ error: "RESEND_WEBHOOK_SECRET 미설정" }, { status: 503 });
  }

  const event = JSON.parse(raw || "null") as ResendEvent | null;
  const type = str(event?.type);
  if (!event || !type) {
    return Response.json({ status: "ignored", reason: "빈 페이로드" });
  }

  // 태그는 객체로 돌아온다: { order_id: "...", kind: "result-email" }
  const tags = (event.data?.tags ?? {}) as Record<string, unknown>;
  const orderId = str(tags.order_id);
  const kind = str(tags.kind) ?? "";
  const emailId = str(event.data?.email_id) ?? "-";

  // 결과 링크 메일만 주문의 수신 여부로 삼는다
  if (!orderId || kind !== "result-email") {
    return Response.json({ status: "ignored", reason: `대상 아님 (${type}/${kind})` });
  }

  const verdict = verdictOf(type);
  if (verdict === "pending") {
    return Response.json({ status: "ignored", reason: `중간 이벤트 (${type})` });
  }

  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) {
    console.warn(`[resend-webhook] 모르는 주문 — 무시: ${orderId} (email_id: ${emailId})`);
    return Response.json({ status: "done", applied: 0 });
  }

  if (verdict === "delivered") {
    await store.recordNotifyDelivery(orderId, { deliveredAt: new Date(), error: null });
    console.log(`[resend-webhook] 수신 확인 — 주문: ${orderId}, ${type}`);
    return Response.json({ status: "done", applied: 1 });
  }

  // ── 실패(bounce·complaint) ──────────────────────────────────
  let reason = `이메일 ${type}`;
  console.error(`[resend-webhook] ${reason} — 주문: ${orderId}`);

  // 다른 통로(알림톡·문자)가 이미 닿았으면 고객은 리포트를 받았다.
  // 실패 기록을 덮어써서 "발송 실패" 큐에 올리면 없는 일을 만드는 셈이다.
  if (order.notifyDeliveredAt) {
    console.warn(`[resend-webhook] 이미 다른 통로로 수신 확인됨 — 경보 생략: ${orderId}`);
    return Response.json({ status: "done", applied: 0, note: "이미 수신 확인" });
  }
  // 이미 문자로 되살렸으면 그 문자의 수신 보고가 따로 온다 — 덮어쓰지 않는다.
  if ((order.notifyError ?? "").startsWith(AUTO_RECOVERED_PREFIX)) {
    console.warn(`[resend-webhook] 이미 문자로 되살린 주문 — 경보 생략: ${orderId}`);
    return Response.json({ status: "done", applied: 0, note: "이미 자동 복구" });
  }

  // 전화번호가 있으면 문자로 되받아친다 — 알림톡 실패 때와 같은 동작.
  if (order.contactPhone && order.reportId) {
    const lmsError = await resendByLms(order);
    if (lmsError === null) {
      await store.recordNotifyDelivery(orderId, {
        deliveredAt: null,
        error: `${AUTO_RECOVERED_PREFIX} ${reason} → 문자 재발송함`,
      });
      console.warn(`[resend-webhook] 메일 반송 → 문자로 재발송 — 주문: ${orderId}`);
      return Response.json({ status: "done", applied: 1, note: "문자 재발송" });
    }
    reason = `${reason} / 문자 재발송도 실패: ${lmsError}`;
  }

  await store.recordNotifyDelivery(orderId, { deliveredAt: null, error: reason });

  await sendOwnerAlert(
    "결과 링크 메일이 반송됐습니다",
    `주문 ${orderId}의 결과 링크 메일이 고객에게 닿지 못했습니다.\n` +
      `사유: ${reason}\n` +
      `어드민 "발송 실패" 큐에서 재발송하거나 직접 연락해 주세요.`
  );

  return Response.json({ status: "done", applied: 1 });
}

/**
 * Resend 이벤트 해석.
 *   email.delivered            수신 완료
 *   email.bounced              영구 거부 — 고객에게 닿지 않았다
 *   email.complained           스팸 신고 — 받긴 했으나 다시 보내면 안 된다
 *   email.sent / .delivery_delayed / .opened / .clicked  중간 상태 (최종 아님)
 */
type Verdict = "delivered" | "failed" | "pending";

function verdictOf(type: string): Verdict {
  if (type === "email.delivered") return "delivered";
  if (type === "email.bounced" || type === "email.complained") return "failed";
  return "pending";
}

/** 결과 링크를 문자로 다시 보낸다. 성공하면 null, 실패하면 사유. */
async function resendByLms(order: Order): Promise<string | null> {
  const report = await getOrderStore().getReport(order.reportId!);
  if (!report) return "리포트를 찾을 수 없음";

  return sendResultLms(order.id, buildResultUrl(report.token), order.contactPhone!).then(
    () => null,
    (err: unknown) => (err instanceof Error ? err.message : String(err))
  );
}
