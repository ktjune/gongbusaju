/**
 * lib/orders/types.ts
 * 주문·자녀정보·리포트 도메인 타입 (SPEC §6 데이터 모델)
 */

import type { Attribution } from "../attribution";

export type Tier = "basic";

/**
 * 주문 상태 (SPEC §3 파이프라인)
 *   paid       결제 완료, 제작 대기
 *   generating 사주 계산·리포트 생성 중
 *   review     생성 완료, 사람 검수 대기
 *   published  검수 통과, 발행(결과페이지·알림)
 *   rejected   검수 반려 (재생성 필요)
 *   failed     생성 중 오류
 *   refunded   환불 완료 (paid/rejected/failed에서 전이, 종료 상태)
 */
export type OrderStatus =
  | "paid"
  | "generating"
  | "review"
  | "published"
  | "rejected"
  | "failed"
  | "refunded";

/** 주문 — 결제·상태·연결. PII는 Subject에 분리 저장. */
export type Order = {
  id: string;
  tier: Tier;
  status: OrderStatus;
  subjectId: string;
  reportId: string | null;
  /** Supabase Auth 사용자 ID (로그인 후 신청 시 연결) */
  userId: string | null;
  /** PG 결제 식별자(포트원 paymentId) — 환불(결제취소) 시 필요. 모의 결제면 null. */
  paymentKey: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  /** 고객이 접수한 환불 요청 시각 — 요청일 뿐 환불 완료가 아니다(refundedAt과 구분). */
  refundRequestedAt: string | null;
  refundRequestReason: string | null;
  /** 결과 링크 발송 실패 사유 — 성공하면 null. 어드민 "발송 실패" 큐에서 사용. */
  notifyError: string | null;
  notifyFailedAt: string | null;
  /** 리포트 생성 시도 횟수 — 자동 재시도 상한(6회)용. 매 생성 시작 시 +1 */
  generateAttempts: number;
  /** 신청자(보호자) 성명 — 결제 시 PG 요구 + 환불 문의 본인 확인용. 암호화 저장. */
  buyerName: string | null;
  /** 연락처(알림 발송용) — 보호자, 별도 동의 */
  contactEmail: string | null;
  contactPhone: string | null;
  /**
   * PG가 확인한 실제 결제 금액(원). 모의 결제는 null.
   * 코드 상수로 계산하지 않는다 — 가격을 바꾸면 과거 매출까지 새 가격이 된다.
   */
  amountKrw: number | null;
  /** 유입 경로 — 결제 시점 기록. 개인정보 아님(캠페인명·유입 도메인·진입 경로뿐). */
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPath: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * 금액·유입 경로 — 주문의 본질이 아니라 측정용 부가 정보다.
 * 측정이 안 되더라도 주문은 만들어져야 하므로 스토어에 넘길 때는 선택 항목으로 둔다.
 */
export type OrderMetrics = Pick<
  Order,
  | "amountKrw"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "referrer"
  | "landingPath"
>;

/** 스토어 createOrder에 넘기는 형태 — 측정 필드는 빠져도 된다. */
export type NewOrder = Omit<
  Order,
  "id" | "createdAt" | "updatedAt" | "generateAttempts" | keyof OrderMetrics
> &
  Partial<OrderMetrics>;

/**
 * 자녀 PII — enc* 필드는 모두 암호화 저장 (lib/crypto/pii).
 * 평문은 메모리에서만 다루고 절대 그대로 저장하지 않는다.
 */
export type Subject = {
  id: string;
  encBirthYear: string;
  encBirthMonth: string;
  encBirthDay: string;
  encBirthHour: string | null;
  encBirthMinute: string | null;
  encGender: string;
  encAddress: string | null;
  encCurrentSchool: string | null;
  /** 아이 이름(한글) — 표지·요약 호명용. LLM에는 전송하지 않는다. */
  encName: string | null;
  /** 아이 이름 한자(선택) — 자원오행 분석용. LLM에는 전송하지 않는다. */
  encNameHanja: string | null;
  consentAt: string;
  retainUntil: string;
  createdAt: string;
};

/** 복호화된 자녀 정보 (계산·생성 시 메모리에서만 사용) */
export type SubjectPlain = {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender: "male" | "female";
  address?: string;
  currentSchool?: string;
  /** 아이 이름(한글, 선택) — 표지·요약 호명용 */
  name?: string;
  /** 아이 이름 한자(선택) — 자원오행 분석용 */
  nameHanja?: string;
};

/** 리포트 — 생성물·토큰·검수 상태 */
export type Report = {
  id: string;
  orderId: string;
  /** 결과페이지 접근 토큰 (추측 불가) */
  token: string;
  /** 최종 마크다운 (assembleReport 출력 — 검수·재생성 원본) */
  markdown: string;
  /** 렌더된 디자인 HTML (결과페이지 표시용 캐시) */
  html: string;
  tier: Tier;
  reviewStatus: "pending" | "approved" | "rejected";
  /** 검수자 메모 (반려 사유 등) */
  reviewNote: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 주문 생성 입력 (신청 폼 → API) */
export type CreateOrderInput = {
  tier: Tier;
  subject: SubjectPlain;
  /** 법정대리인 동의 시각 */
  consentAt?: string;
  /** PII 보관 기간(개월). 기본 12개월 */
  retainMonths?: number;
  /** 신청자(보호자) 성명 — 결제·환불 문의 확인용 */
  buyerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Supabase Auth 사용자 ID (로그인 후 신청 시) */
  userId?: string;
  /** PG 결제 식별자(포트원 paymentId) — 환불 시 필요. 모의 결제면 미전달. */
  paymentKey?: string;
  /** PG가 확인한 결제 금액(원) — 클라이언트 값이 아니라 결제 조회 결과를 넣는다. */
  amountKrw?: number;
  /** 유입 경로 — 클라이언트가 sessionStorage에서 읽어 보낸다(lib/attribution). */
  attribution?: Attribution;
};
