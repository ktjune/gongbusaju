/**
 * lib/payments/portone.ts
 * 포트원(PortOne) V2 결제 검증·취소 — 서버 전용.
 *
 * 클라이언트가 PortOne.requestPayment()로 결제한 뒤 paymentId를 보내오면,
 * 그 값을 그대로 신뢰하지 않고 서버가 API 시크릿으로 결제 내역을 조회해
 * "실제로 결제됐는지 · 금액이 맞는지"를 검증한 뒤에만 주문을 만든다.
 *
 * PG는 포트원 콘솔의 채널 설정으로 결정된다(현재 NHN KCP). PG를 바꿔도
 * 이 코드는 그대로이고 채널키만 교체하면 된다 — 토스 직연동을 걷어낸 이유.
 *
 * 환경변수:
 *   PORTONE_API_SECRET             — V2 API 시크릿 (서버 전용, 절대 노출 금지)
 *   NEXT_PUBLIC_PORTONE_STORE_ID   — 상점 ID (공개)
 *   NEXT_PUBLIC_PORTONE_CHANNEL_KEY— 채널 키 (공개)
 */

/** 리포트 1부 가격 (원). 결제 금액 검증의 단일 기준. (정가 29,000 → 할인가 9,900) */
export const REPORT_PRICE = 9900;

const API_BASE = "https://api.portone.io";

/** 결제 완료로 인정하는 상태 — 가상계좌 발급(입금 전)은 제외한다 */
const PAID_STATUS = "PAID";

export type PortOnePayment = {
  /** 우리가 발급한 결제 고유 ID */
  id: string;
  status: string;
  amount: { total: number; paid?: number };
  orderName?: string;
  method?: { type?: string };
  paidAt?: string;
};

function authHeader(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    throw new Error("PORTONE_API_SECRET 미설정 — 결제 검증 불가");
  }
  return `PortOne ${secret}`;
}

/**
 * 결제를 검증한다 — 포트원에 실제 결제 내역을 조회해 상태·금액을 확인.
 *
 * @throws 조회 실패·미결제·금액 불일치 시 Error (주문을 만들면 안 되는 상황)
 */
export async function verifyPortOnePayment(
  paymentId: string
): Promise<PortOnePayment> {
  if (!paymentId?.trim()) {
    throw new Error("결제 정보(paymentId)가 없습니다.");
  }

  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: authHeader() } }
  );

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const type = (data.type as string) ?? "";
    const message = (data.message as string) ?? "결제 조회 실패";
    throw new Error(`포트원 결제 조회 실패 (${type}): ${message}`);
  }

  const payment = data as unknown as PortOnePayment;

  // 결제가 실제로 완료됐는지 (가상계좌 미입금·취소·실패 모두 여기서 걸린다)
  if (payment.status !== PAID_STATUS) {
    throw new Error(`결제가 완료되지 않았습니다: ${payment.status}`);
  }

  // 금액 위변조 방지 — 클라이언트가 보낸 값이 아니라 PG가 확인한 금액으로 검증
  const total = payment.amount?.total;
  if (total !== REPORT_PRICE) {
    throw new Error(`결제 금액 불일치: ${total}`);
  }

  return payment;
}

export type PortOneCancelResult = {
  cancellation?: { status?: string; id?: string };
};

/**
 * 결제를 취소(전액 환불)한다.
 *
 * @throws 취소 실패(이미 취소됨·존재하지 않는 결제·PG 오류) 시 Error
 */
export async function cancelPortOnePayment(
  paymentId: string,
  reason: string
): Promise<PortOneCancelResult> {
  const res = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  );

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const type = (data.type as string) ?? "";
    const message = (data.message as string) ?? "결제 취소 실패";
    throw new Error(`포트원 결제 취소 실패 (${type}): ${message}`);
  }

  return data as PortOneCancelResult;
}

/** 결제 고유 ID 생성 — 우리가 만들어 PG에 전달하는 주문 식별자 */
export function newPaymentId(): string {
  return `gbg_${crypto.randomUUID().replace(/-/g, "")}`;
}
