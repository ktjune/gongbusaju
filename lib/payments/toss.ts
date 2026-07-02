/**
 * lib/payments/toss.ts
 * 토스페이먼츠 결제 승인(confirm) — 서버 전용.
 *
 * 결제위젯에서 결제가 끝나면 successUrl로 paymentKey·orderId·amount가 전달된다.
 * 이 값을 그대로 신뢰하지 않고, 서버가 시크릿 키로 승인 API를 호출해
 * 실제 결제가 맞는지·금액이 맞는지 검증한 뒤에만 주문을 생성한다.
 *
 * 환경변수:
 *   TOSS_SECRET_KEY            — 시크릿 키 (서버 전용, 절대 클라이언트 노출 금지)
 *   NEXT_PUBLIC_TOSS_CLIENT_KEY — 클라이언트 키 (위젯용, 공개)
 */

/** 리포트 1부 가격 (원). 결제 금액 검증의 단일 기준. (정가 29,000 → 할인가 9,900) */
export const REPORT_PRICE = 9900;

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
const cancelUrl = (paymentKey: string) =>
  `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`;

export type TossConfirmInput = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string; // DONE 이면 결제 완료
  totalAmount: number;
  method?: string;
  approvedAt?: string;
};

/**
 * 토스 결제를 승인(검증)한다.
 *
 * @throws 승인 실패(위변조·금액 불일치·토스 오류) 시 Error
 */
export async function confirmTossPayment(
  input: TossConfirmInput
): Promise<TossPayment> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY 미설정 — 결제 승인 불가");
  }

  // 금액 위변조 방지: 클라이언트가 보낸 금액이 정가와 다르면 즉시 거부
  if (input.amount !== REPORT_PRICE) {
    throw new Error(`결제 금액 불일치: ${input.amount}`);
  }

  // Basic 인증: "시크릿키:" 를 base64 (비밀번호 없이 콜론만)
  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  const res = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const code = (data.code as string) ?? "";
    const message = (data.message as string) ?? "결제 승인 실패";
    throw new Error(`토스 결제 승인 실패 (${code}): ${message}`);
  }

  const payment = data as unknown as TossPayment;

  // 최종 방어: 토스가 확인한 금액·상태 재검증
  if (payment.totalAmount !== REPORT_PRICE) {
    throw new Error(`승인 금액 불일치: ${payment.totalAmount}`);
  }
  if (payment.status !== "DONE") {
    throw new Error(`결제가 완료되지 않았습니다: ${payment.status}`);
  }

  return payment;
}

export type TossCancelResult = {
  paymentKey: string;
  status: string; // CANCELED 이면 취소 완료
};

/**
 * 토스 결제를 취소(전액 환불)한다.
 *
 * @throws 취소 실패(이미 취소됨·존재하지 않는 결제·토스 오류) 시 Error
 */
export async function cancelTossPayment(
  paymentKey: string,
  cancelReason: string
): Promise<TossCancelResult> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY 미설정 — 결제 취소 불가");
  }

  const auth = Buffer.from(`${secretKey}:`).toString("base64");

  const res = await fetch(cancelUrl(paymentKey), {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancelReason }),
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const code = (data.code as string) ?? "";
    const message = (data.message as string) ?? "결제 취소 실패";
    throw new Error(`토스 결제 취소 실패 (${code}): ${message}`);
  }

  return data as unknown as TossCancelResult;
}
