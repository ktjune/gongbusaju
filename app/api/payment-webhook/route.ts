/**
 * POST /api/payment-webhook — 포트원 결제 웹훅
 *
 * 목적: **미아 결제 탐지**. 결제는 승인됐는데 우리 DB에 주문이 없는 상태
 * (결제창 이탈·모바일 리다이렉트 실패·네트워크 끊김으로 /api/order가 호출되지
 * 못한 경우)를 잡아 운영자에게 알린다. 그대로 두면 고객은 돈만 내고 아무것도
 * 못 받는다.
 *
 * 안전장치:
 *  1. Standard Webhooks 서명 검증(lib/payments/webhook) — 통과해야만 처리.
 *     시크릿 미설정이면 아무 것도 하지 않는다(위조 요청으로 오탐 알림이 쏟아지는 것 방지).
 *  2. 본문의 금액·상태를 믿지 않고 paymentId로 PG에 재조회한다.
 *  3. **자동 취소하지 않는다.** /api/order가 결제 직후 몇 초에 걸쳐 주문을 만드는
 *     중일 수 있어, 웹훅이 먼저 도착하면 정상 주문을 취소해버린다. 그래서
 *     유예 시간(ORPHAN_GRACE_MS)이 지난 결제만 미아로 보고 알림만 보낸다.
 *     실제 취소는 운영자가 어드민/PG 콘솔에서 판단해 실행한다.
 *
 * 환경변수: PORTONE_WEBHOOK_SECRET (포트원 콘솔 → 웹훅)
 */

import { getOrderStore } from "@/lib/orders";
import { sendOwnerAlert } from "@/lib/notify";
import { verifyPortOnePayment } from "@/lib/payments/portone";
import { extractWebhookHeaders, verifyWebhook } from "@/lib/payments/webhook";

export const runtime = "nodejs";

/** 결제 후 이 시간이 지나도 주문이 없으면 미아로 판단한다 */
const ORPHAN_GRACE_MS = 3 * 60 * 1000; // 3분

/** 결제 완료를 뜻하는 웹훅 타입 접두사 */
const PAID_TYPE = "Transaction.Paid";

type PortOneWebhookBody = {
  type?: string;
  data?: { paymentId?: string; transactionId?: string };
};

export async function POST(req: Request) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;

  // 서명 검증 없이는 아무 것도 처리하지 않는다 — 위조 요청 차단
  if (!secret) {
    console.warn("[payment-webhook] PORTONE_WEBHOOK_SECRET 미설정 — 수신만 하고 무시");
    return Response.json({ received: true });
  }

  // 서명은 **raw body** 기준이므로 파싱 전에 문자열로 읽는다
  const raw = await req.text();

  try {
    verifyWebhook(raw, extractWebhookHeaders(req), secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서명 검증 실패";
    console.warn(`[payment-webhook] 서명 검증 실패 — 무시: ${msg}`);
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: PortOneWebhookBody;
  try {
    body = JSON.parse(raw) as PortOneWebhookBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  const paymentId = body.data?.paymentId;
  if (!body.type?.startsWith(PAID_TYPE) || !paymentId) {
    // 결제 완료 외 이벤트(취소·가상계좌 발급 등)는 지금 처리 대상이 아니다
    return Response.json({ received: true });
  }

  try {
    // 본문 값을 믿지 않고 PG 기록으로 재확인 (상태 PAID + 금액 9,900원)
    const payment = await verifyPortOnePayment(paymentId);

    // 우리 DB에 이 결제로 만들어진 주문이 있는가
    const store = getOrderStore();
    const matched = await store.getOrderByPaymentKey(paymentId);

    if (matched) {
      return Response.json({ received: true, orderId: matched.id });
    }

    // 아직 /api/order가 주문을 만드는 중일 수 있다 — 유예 시간 안이면 판단 보류
    const paidAt = payment.paidAt ? Date.parse(payment.paidAt) : Date.now();
    if (Date.now() - paidAt < ORPHAN_GRACE_MS) {
      return Response.json({ received: true, pending: true });
    }

    // 미아 결제 — 돈은 빠졌는데 주문이 없다. 운영자가 즉시 알아야 한다.
    console.error(`[payment-webhook] 미아 결제 감지 — paymentId: ${paymentId}`);
    await sendOwnerAlert(
      "[공부결] ⚠️ 미아 결제 감지 — 결제됐으나 주문 없음",
      `결제는 승인됐는데 대응하는 주문이 없습니다.\n\n` +
        `paymentId: ${paymentId}\n` +
        `금액: ${payment.amount?.total ?? "-"}원\n` +
        `결제시각: ${payment.paidAt ?? "-"}\n\n` +
        `고객이 돈만 내고 리포트를 못 받은 상태입니다.\n` +
        `포트원 콘솔에서 결제를 확인하고 환불 처리해 주세요.`
    );

    return Response.json({ received: true, orphan: true });
  } catch (e) {
    // 조회 실패·알림 실패 — 200을 반환해 웹훅 재시도 폭주는 막고 로그로 남긴다
    console.error(`[payment-webhook] 처리 실패 — paymentId: ${paymentId}`, e);
    return Response.json({ received: true, error: true });
  }
}
