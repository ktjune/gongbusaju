/**
 * POST /api/payment-webhook — 결제 웹훅 수신 (포트원)
 *
 * [현재 상태] 스텁 — 주문 생성은 /api/order 의 동기 검증 경로가 담당한다.
 * 이 엔드포인트는 아직 주문 상태를 바꾸지 않는다(위조 요청으로 주문이
 * 발행되는 사고를 막기 위해 의도적으로 no-op).
 *
 * [구현할 때 반드시]
 * 1. 포트원 콘솔에서 웹훅 시크릿 발급 → PORTONE_WEBHOOK_SECRET 설정
 * 2. 서명 검증(@portone/server-sdk 의 Webhook.verify) 통과 후에만 처리
 * 3. 본문의 금액을 믿지 말고 paymentId로 결제를 재조회해 검증
 *    (lib/payments/portone.verifyPortOnePayment 재사용)
 *
 * 용도: 가상계좌 입금 통보, 결제창 이탈 후 지연 승인 등 비동기 상태 변화 반영.
 */

export const runtime = "nodejs";

type PortOneWebhookBody = {
  type?: string;
  data?: { paymentId?: string; status?: string };
};

export async function POST(req: Request) {
  let body: PortOneWebhookBody;
  try {
    body = (await req.json()) as PortOneWebhookBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  const paymentId = body.data?.paymentId;
  console.warn(
    `[payment-webhook] 수신됨 (미연동 스텁). type=${body.type ?? "-"}, paymentId=${paymentId ?? "-"}`
  );

  // 200이 아니면 재시도되므로, 스텁은 200을 반환해 재시도 폭주를 막는다
  return Response.json({ received: true });
}
