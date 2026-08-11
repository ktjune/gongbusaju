/**
 * lib/payments/classify.ts
 * 저장된 결제 식별자(orders.paymentKey)가 "진짜 돈이 오간 결제"인지 판별한다.
 *
 * 왜 필요한가: 어드민 환불 버튼은 지금까지 paymentKey 유무(있음/없음)만 알았다.
 * 그런데 PG 심사 기간에는 테스트 키로 결제가 정상 승인되고 취소까지 되며,
 * PG사는 그때도 "결제가 취소되었어요" 안내 메일을 자동 발송한다.
 * 그래서 메일만 봐서는 실제로 환불된 돈이 있는지 운영자가 구분할 수 없다.
 * 이 함수가 그 구분을 코드로 못박는다.
 *
 * 판별 근거(접두사):
 *   null      → 모의 결제. PG 미설정 개발 환경에서 만들어진 주문
 *   tgen_…    → 토스페이먼츠 **테스트** 결제. 실제 출금 없음
 *   gbg_…     → 우리가 발급한 포트원 paymentId (newPaymentId). 실/테스트는
 *               채널 설정에 달려 있어 접두사만으로는 알 수 없다 → PG 조회 필요
 *   그 외      → 토스 실결제 키 등, 실결제로 취급(보수적)
 */

/** 결제 성격 — 운영자가 "환불할 돈이 있나"를 판단하는 축 */
export type PaymentKind =
  /** 결제 자체가 없었음 (모의 주문) */
  | "none"
  /** PG 테스트 결제 — 승인·취소 모두 되지만 실제 출금은 없음 */
  | "test"
  /** 실제 돈이 오갔을 수 있음 — PG 조회로 최종 확인 필요 */
  | "live"
  /** 접두사만으로 단정 불가 — PG 조회 필요 */
  | "unknown";

export type PaymentClassification = {
  kind: PaymentKind;
  /** 어드민에 그대로 표시할 짧은 라벨 */
  label: string;
  /** 실제 출금이 있었을 가능성이 있어 환불 시 주의가 필요한가 */
  needsCare: boolean;
  /** PG사 이름 (조회 위치 안내용). 알 수 없으면 null */
  provider: "toss" | "portone" | null;
};

/** 토스페이먼츠 테스트 결제 키 접두사 (예: tgen_20260807175400xvGs6) */
const TOSS_TEST_PREFIX = "tgen_";
/** 우리가 발급하는 포트원 paymentId 접두사 (newPaymentId) */
const PORTONE_PREFIX = "gbg_";

/**
 * paymentKey를 보고 결제 성격을 판별한다.
 *
 * 주의: "test"가 아니라고 해서 실결제가 확정되는 것은 아니다. 포트원은
 * 테스트/실 채널이 같은 형식의 paymentId를 쓰므로 최종 확인은 PG 조회로 한다.
 */
export function classifyPayment(paymentKey: string | null | undefined): PaymentClassification {
  if (!paymentKey) {
    return { kind: "none", label: "모의결제", needsCare: false, provider: null };
  }

  if (paymentKey.startsWith(TOSS_TEST_PREFIX)) {
    return { kind: "test", label: "토스 테스트", needsCare: false, provider: "toss" };
  }

  if (paymentKey.startsWith(PORTONE_PREFIX)) {
    // 포트원은 채널(테스트/실연동)에 따라 갈리므로 접두사로 단정하지 않는다
    return { kind: "unknown", label: "포트원 (조회 필요)", needsCare: true, provider: "portone" };
  }

  return { kind: "live", label: "실결제", needsCare: true, provider: "toss" };
}

/** 실제 출금이 있었을 수 있는 결제인가 — 환불 확인창 문구 분기에 쓴다 */
export function mayInvolveRealMoney(paymentKey: string | null | undefined): boolean {
  return classifyPayment(paymentKey).needsCare;
}
