/**
 * lib/orders — 주문 도메인 진입점
 *
 * 신청 → 주문 생성(PII 암호화) → 상태 전이 → 검수/발행.
 * 저장소는 OrderStore 인터페이스로 추상화 (인메모리 ↔ Prisma 교체 가능).
 *
 * [절대 규칙] 자녀 PII는 lib/crypto/pii로 암호화 후 저장. 평문 미저장.
 */

import {
  encryptPii,
  encryptPiiNullable,
  decryptPii,
  decryptPiiNullable,
} from "../crypto/pii";
import { assertTransition } from "./status";
import { getOrderStore } from "./store";
import type {
  CreateOrderInput,
  Order,
  OrderStatus,
  Subject,
  SubjectPlain,
} from "./types";

export type {
  Order,
  OrderStatus,
  Subject,
  SubjectPlain,
  Report,
  Tier,
  CreateOrderInput,
} from "./types";
export { canTransition, assertTransition, isTerminal } from "./status";
export type { OrderStore } from "./store";
export { getOrderStore, InMemoryOrderStore, newReportToken } from "./store";
export { generateReportForOrder, isGeneratable } from "./generate";
export { approveReport, rejectReport, listPendingReports, retryNotify } from "./review";
export { refundOrder } from "./refund";

/** SubjectPlain → 암호화된 Subject 필드 (저장 직전 변환) */
function encryptSubject(
  s: SubjectPlain,
  consentAt: string,
  retainUntil: string
): Omit<Subject, "id" | "createdAt"> {
  return {
    encBirthYear: encryptPii(String(s.birthYear)),
    encBirthMonth: encryptPii(String(s.birthMonth)),
    encBirthDay: encryptPii(String(s.birthDay)),
    encBirthHour: encryptPiiNullable(s.birthHour != null ? String(s.birthHour) : null),
    encBirthMinute: encryptPiiNullable(s.birthMinute != null ? String(s.birthMinute) : null),
    encGender: encryptPii(s.gender),
    encAddress: encryptPiiNullable(s.address),
    encCurrentSchool: encryptPiiNullable(s.currentSchool),
    encName: encryptPiiNullable(s.name),
    encNameHanja: encryptPiiNullable(s.nameHanja),
    consentAt,
    retainUntil,
  };
}

/** 암호화된 Subject → 복호화된 SubjectPlain (계산·생성 시 메모리에서만) */
export function decryptSubject(s: Subject): SubjectPlain {
  const hour = decryptPiiNullable(s.encBirthHour);
  const minute = decryptPiiNullable(s.encBirthMinute);
  const gender = decryptPii(s.encGender);
  return {
    birthYear: Number(decryptPii(s.encBirthYear)),
    birthMonth: Number(decryptPii(s.encBirthMonth)),
    birthDay: Number(decryptPii(s.encBirthDay)),
    birthHour: hour != null ? Number(hour) : undefined,
    birthMinute: minute != null ? Number(minute) : undefined,
    gender: gender === "female" ? "female" : "male",
    address: decryptPiiNullable(s.encAddress) ?? undefined,
    currentSchool: decryptPiiNullable(s.encCurrentSchool) ?? undefined,
    name: decryptPiiNullable(s.encName) ?? undefined,
    nameHanja: decryptPiiNullable(s.encNameHanja) ?? undefined,
  };
}

/** 한국 휴대폰·유선·안심번호 등 숫자/하이픈 위주 전화번호 (느슨한 형식 검증) */
const PHONE_RE = /^[0-9-+() ]{8,20}$/;
/** 평범한 이메일 형식 검증 (RFC 완전 준수 대신 명백한 오타·인젝션만 거름) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 자유 입력 텍스트(주소·학교명)의 최대 길이 — 비정상적으로 긴 입력으로 인한 저장소 남용 방지 */
const MAX_FREE_TEXT_LEN = 200;

/** 입력 검증 — 신뢰 못 할 외부 입력을 도메인 경계에서 거른다 */
function validateInput(input: CreateOrderInput): void {
  const { subject: s, tier } = input;
  if (tier !== "basic" && tier !== "premium") {
    throw new Error("잘못된 요금제");
  }
  const y = s.birthYear;
  if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) {
    throw new Error("생년이 올바르지 않습니다");
  }
  if (!Number.isInteger(s.birthMonth) || s.birthMonth < 1 || s.birthMonth > 12) {
    throw new Error("생월이 올바르지 않습니다");
  }
  if (!Number.isInteger(s.birthDay) || s.birthDay < 1 || s.birthDay > 31) {
    throw new Error("생일이 올바르지 않습니다");
  }
  if (s.birthHour != null && (s.birthHour < 0 || s.birthHour > 23)) {
    throw new Error("출생 시가 올바르지 않습니다");
  }
  if (s.gender !== "male" && s.gender !== "female") {
    throw new Error("성별이 올바르지 않습니다");
  }
  // 주소는 선택 입력 — 있으면 학교 사실 섹션이 추가되고, 없으면 사주 해석만 생성된다.
  if (s.address != null && s.address.length > MAX_FREE_TEXT_LEN) {
    throw new Error("주소가 너무 길습니다");
  }
  if (s.currentSchool != null && s.currentSchool.length > MAX_FREE_TEXT_LEN) {
    throw new Error("재학 학교명이 너무 길습니다");
  }
  // 이름·한자는 선택 입력 — 짧게 제한.
  if (s.name != null && s.name.length > 20) {
    throw new Error("이름이 너무 깁니다");
  }
  if (s.nameHanja != null && s.nameHanja.length > 20) {
    throw new Error("이름 한자가 너무 깁니다");
  }
  if (input.contactEmail != null && !EMAIL_RE.test(input.contactEmail)) {
    throw new Error("이메일 형식이 올바르지 않습니다");
  }
  if (input.contactPhone != null && !PHONE_RE.test(input.contactPhone)) {
    throw new Error("전화번호 형식이 올바르지 않습니다");
  }
}

/**
 * 주문을 생성한다. (결제 완료 후 호출 — status=paid로 시작)
 *
 * 1. 입력 검증
 * 2. 자녀 PII 암호화 → Subject 저장
 * 3. Order 저장 (Subject 참조, status=paid)
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  validateInput(input);
  const store = getOrderStore();

  const consentAt = input.consentAt ?? new Date().toISOString();
  const retainMonths = input.retainMonths ?? 6;
  const retainUntil = new Date(
    Date.now() + retainMonths * 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const subject = await store.createSubject(
    encryptSubject(input.subject, consentAt, retainUntil)
  );

  return store.createOrder({
    tier: input.tier,
    status: "paid",
    subjectId: subject.id,
    reportId: null,
    userId: input.userId ?? null,
    paymentKey: input.paymentKey ?? null,
    refundedAt: null,
    refundReason: null,
    notifyError: null,
    notifyFailedAt: null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
  });
}

/** 주문 상태를 전이한다 (전이 규칙 검증 포함). */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus
): Promise<Order> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);
  assertTransition(order.status, to);
  return store.updateOrderStatus(orderId, to);
}
