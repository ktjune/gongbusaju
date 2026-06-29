/**
 * lib/orders/types.ts
 * 주문·자녀정보·리포트 도메인 타입 (SPEC §6 데이터 모델)
 */

export type Tier = "basic" | "premium";

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
  /** 토스 결제 승인 키 — 환불(결제취소) 시 필요. 모의 결제(TOSS_SECRET_KEY 미설정)면 null. */
  paymentKey: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  /** 결과 링크 발송 실패 사유 — 성공하면 null. 어드민 "발송 실패" 큐에서 사용. */
  notifyError: string | null;
  notifyFailedAt: string | null;
  /** 연락처(알림 발송용) — 보호자, 별도 동의 */
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  contactEmail?: string;
  contactPhone?: string;
  /** Supabase Auth 사용자 ID (로그인 후 신청 시) */
  userId?: string;
  /** 토스 결제 승인 키 — 환불 시 필요. 모의 결제(TOSS_SECRET_KEY 미설정)면 미전달. */
  paymentKey?: string;
};
