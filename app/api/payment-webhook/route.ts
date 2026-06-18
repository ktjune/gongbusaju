/**
 * POST /api/payment-webhook — 결제 웹훅 수신
 *
 * [현재 상태] 스텁 — Toss Payments 연동 전
 *
 * [구현 예정: Toss Payments]
 * 1. TOSS_SECRET_KEY 환경변수 설정
 * 2. 아래 TODO 주석 위치에 실 검증 로직 추가:
 *    - Toss 서명 검증: Authorization 헤더 Bearer {base64(secretKey:)}
 *    - 결제 상태 확인: paymentKey로 /v1/payments/{paymentKey} 조회
 *    - orderId로 주문 조회 → createOrder / updateOrderStatus 호출
 *
 * [웹훅 형식 — Toss Payments]
 * POST https://api.tosspayments.com/v1/payments/{paymentKey}/confirm
 * body: { paymentKey, orderId, amount }
 *
 * [보안]
 * - 서명 없이 받으면 임의 주문 발행 위험 → 반드시 검증 후 처리
 * - POST body size 제한 (예: 64KB) 걸 것
 */

export const runtime = "nodejs";

type TossWebhookBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  status?: string;
};

export async function POST(req: Request) {
  let body: TossWebhookBody;
  try {
    body = (await req.json()) as TossWebhookBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식" }, { status: 400 });
  }

  // TODO [Toss 연동]: TOSS_SECRET_KEY로 Authorization 헤더 검증
  // const secretKey = process.env.TOSS_SECRET_KEY;
  // if (!secretKey) return Response.json({ error: "결제 미연동" }, { status: 501 });
  // const authHeader = req.headers.get("authorization");
  // const expected = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;
  // if (authHeader !== expected) return Response.json({ error: "인증 실패" }, { status: 401 });

  if (!body.paymentKey || !body.orderId) {
    return Response.json({ error: "paymentKey, orderId 필요" }, { status: 400 });
  }

  // TODO [Toss 연동]: 결제 상태 확인 후 주문 상태 업데이트
  // const confirmed = await confirmTossPayment(body.paymentKey, body.orderId, body.amount);
  // await createOrder({ ... }) or await store.updateOrderStatus(body.orderId, "paid");

  console.warn(
    `[payment-webhook] 수신됨 (미연동 스텁). paymentKey=${body.paymentKey}, orderId=${body.orderId}`
  );

  // Toss는 200이 아닌 경우 재시도 — 스텁은 200 반환해 재시도 방지
  return Response.json({ received: true });
}
