/**
 * lib/orders + lib/crypto 도메인 테스트
 *
 * - PII 암호화 왕복 / 변조 감지
 * - 주문 생성(암호화 저장) / 상태 전이 규칙
 * - 인메모리 저장소 동작
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptPii,
  decryptPii,
  encryptPiiNullable,
  decryptPiiNullable,
  sajuInputHash,
} from "../../crypto/pii";
import {
  createOrder,
  transitionOrder,
  decryptSubject,
  canTransition,
  getOrderStore,
  InMemoryOrderStore,
  refundOrder,
  retryNotify,
} from "../index";
import type { CreateOrderInput } from "../index";

// 각 테스트 전 저장소 초기화 (전역 싱글턴 교체)
beforeEach(() => {
  (globalThis as unknown as { __orderStore?: unknown }).__orderStore =
    new InMemoryOrderStore();
});

// ──────────────────────────────────────────────────────────────
// 1. PII 암호화
// ──────────────────────────────────────────────────────────────

describe("PII 암호화 — AES-256-GCM", () => {
  it("암호화 후 복호화하면 원문이 나온다", () => {
    const plain = "2020";
    const enc = encryptPii(plain);
    expect(enc).not.toBe(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptPii(enc)).toBe(plain);
  });

  it("한글 주소도 왕복된다", () => {
    const addr = "서울특별시 종로구 자하문로 105";
    expect(decryptPii(encryptPii(addr))).toBe(addr);
  });

  it("같은 평문도 매번 다른 암호문 (IV 랜덤)", () => {
    expect(encryptPii("male")).not.toBe(encryptPii("male"));
  });

  it("변조된 암호문은 복호화 실패 (인증 태그)", () => {
    const enc = encryptPii("secret");
    const tampered = enc.slice(0, -4) + "AAAA";
    expect(() => decryptPii(tampered)).toThrow();
  });

  it("nullable 헬퍼: null은 그대로 통과", () => {
    expect(encryptPiiNullable(null)).toBeNull();
    expect(encryptPiiNullable("")).toBeNull();
    expect(decryptPiiNullable(null)).toBeNull();
    const enc = encryptPiiNullable("값");
    expect(decryptPiiNullable(enc)).toBe("값");
  });

  it("sajuInputHash: 같은 입력 = 같은 해시, 다른 입력 = 다른 해시", () => {
    const a = { birthYear: 2020, birthMonth: 9, birthDay: 16, birthHour: 16, gender: "male" as const };
    const b = { ...a, birthHour: 17 };
    expect(sajuInputHash(a)).toBe(sajuInputHash(a));
    expect(sajuInputHash(a)).not.toBe(sajuInputHash(b));
    expect(sajuInputHash(a)).toHaveLength(64); // SHA-256 hex
  });
});

// ──────────────────────────────────────────────────────────────
// 2. 상태 전이 규칙
// ──────────────────────────────────────────────────────────────

describe("주문 상태 전이 규칙", () => {
  it("정상 흐름: paid→generating→review→published", () => {
    expect(canTransition("paid", "generating")).toBe(true);
    expect(canTransition("generating", "review")).toBe(true);
    expect(canTransition("review", "published")).toBe(true);
  });

  it("검수 반려 후 재생성: review→rejected→generating", () => {
    expect(canTransition("review", "rejected")).toBe(true);
    expect(canTransition("rejected", "generating")).toBe(true);
  });

  it("건너뛰기 금지: paid→published 불가", () => {
    expect(canTransition("paid", "published")).toBe(false);
  });

  it("환불(refunded)은 종료 상태 — 전이 불가", () => {
    expect(canTransition("refunded", "generating")).toBe(false);
    expect(canTransition("refunded", "published")).toBe(false);
  });

  it("published는 재생성(generating)·환불(refunded)만 허용", () => {
    expect(canTransition("published", "generating")).toBe(true);
    expect(canTransition("published", "refunded")).toBe(true);
    expect(canTransition("published", "rejected")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. 주문 생성 — PII 암호화 저장
// ──────────────────────────────────────────────────────────────

const basicInput: CreateOrderInput = {
  tier: "basic",
  subject: {
    birthYear: 2020,
    birthMonth: 9,
    birthDay: 16,
    birthHour: 16,
    birthMinute: 43,
    gender: "male",
  },
  contactEmail: "parent@example.com",
};

describe("createOrder — PII 암호화 저장", () => {
  it("주문이 status=paid로 생성된다", async () => {
    const order = await createOrder(basicInput);
    expect(order.status).toBe("paid");
    expect(order.tier).toBe("basic");
    expect(order.subjectId).toBeTruthy();
    expect(order.reportId).toBeNull();
  });

  it("Subject에 평문 생년월일이 저장되지 않는다 (암호화 확인)", async () => {
    const order = await createOrder(basicInput);
    const store = getOrderStore();
    const subject = await store.getSubject(order.subjectId);
    expect(subject).not.toBeNull();
    // 평문 "2020"이 그대로 들어있으면 안 된다
    expect(subject!.encBirthYear).not.toBe("2020");
    expect(subject!.encBirthYear.startsWith("v1:")).toBe(true);
  });

  it("decryptSubject로 원본 복원", async () => {
    const order = await createOrder(basicInput);
    const store = getOrderStore();
    const subject = await store.getSubject(order.subjectId);
    const plain = decryptSubject(subject!);
    expect(plain.birthYear).toBe(2020);
    expect(plain.birthMonth).toBe(9);
    expect(plain.birthHour).toBe(16);
    expect(plain.gender).toBe("male");
  });

  it("retainUntil 보관기간이 미래로 설정된다", async () => {
    const order = await createOrder(basicInput);
    const store = getOrderStore();
    const subject = await store.getSubject(order.subjectId);
    expect(new Date(subject!.retainUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it("시간 모름: birthHour 미지정도 처리", async () => {
    const order = await createOrder({
      tier: "basic",
      subject: { birthYear: 2019, birthMonth: 3, birthDay: 1, gender: "female" },
    });
    const store = getOrderStore();
    const subject = await store.getSubject(order.subjectId);
    expect(subject!.encBirthHour).toBeNull();
    const plain = decryptSubject(subject!);
    expect(plain.birthHour).toBeUndefined();
    expect(plain.gender).toBe("female");
  });

  it("주소가 없어도 주문이 생성된다 (주소는 선택 입력)", async () => {
    const order = await createOrder({ tier: "basic", subject: basicInput.subject });
    expect(order.id).toBeTruthy();
    expect(order.status).toBe("paid");
  });

  it("주소가 암호화 저장·복원된다", async () => {
    const order = await createOrder({
      tier: "basic",
      subject: { ...basicInput.subject, address: "서울특별시 종로구 자하문로 105", currentSchool: "청운초등학교" },
    });
    const store = getOrderStore();
    const subject = await store.getSubject(order.subjectId);
    expect(subject!.encAddress!.startsWith("v1:")).toBe(true);
    const plain = decryptSubject(subject!);
    expect(plain.address).toBe("서울특별시 종로구 자하문로 105");
    expect(plain.currentSchool).toBe("청운초등학교");
  });

  it("잘못된 생년 거부", async () => {
    await expect(
      createOrder({ tier: "basic", subject: { ...basicInput.subject, birthYear: 1800 } })
    ).rejects.toThrow(/생년/);
  });

  it("이메일 형식이 잘못되면 거부", async () => {
    await expect(
      createOrder({ ...basicInput, contactEmail: "not-an-email" })
    ).rejects.toThrow(/이메일/);
  });

  it("전화번호 형식이 잘못되면 거부", async () => {
    await expect(
      createOrder({ ...basicInput, contactPhone: "<script>alert(1)</script>" })
    ).rejects.toThrow(/전화번호/);
  });

  it("정상적인 이메일·전화번호는 통과", async () => {
    const order = await createOrder({
      ...basicInput,
      contactEmail: "parent@example.com",
      contactPhone: "010-1234-5678",
    });
    expect(order.id).toBeTruthy();
  });

  it("주소가 너무 길면 거부", async () => {
    await expect(
      createOrder({
        tier: "basic",
        subject: { ...basicInput.subject, address: "a".repeat(201) },
      })
    ).rejects.toThrow(/주소/);
  });
});

// ──────────────────────────────────────────────────────────────
// 4. transitionOrder — 전이 검증
// ──────────────────────────────────────────────────────────────

describe("transitionOrder", () => {
  it("paid→generating 성공, 상태 갱신", async () => {
    const order = await createOrder(basicInput);
    const updated = await transitionOrder(order.id, "generating");
    expect(updated.status).toBe("generating");
  });

  it("잘못된 전이는 거부 (paid→published)", async () => {
    const order = await createOrder(basicInput);
    await expect(transitionOrder(order.id, "published")).rejects.toThrow(/전이/);
  });

  it("없는 주문 전이 시 에러", async () => {
    await expect(transitionOrder("nonexistent", "generating")).rejects.toThrow(/주문 없음/);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. refundOrder — 환불 처리
// ──────────────────────────────────────────────────────────────

describe("refundOrder", () => {
  it("paid(제작 착수 전) 주문은 환불 가능 — 모의결제(paymentKey 없음)는 토스 호출 없이 상태만 전이", async () => {
    const order = await createOrder(basicInput); // paymentKey 미전달 = 모의 결제
    const refunded = await refundOrder(order.id, "고객 단순 변심");
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundReason).toBe("고객 단순 변심");
    expect(refunded.refundedAt).toBeTruthy();
  });

  it("사유 미입력 시 기본 사유로 기록된다", async () => {
    const order = await createOrder(basicInput);
    const refunded = await refundOrder(order.id);
    expect(refunded.refundReason).toBe("고객 요청 환불");
  });

  it("rejected(반려됨) 주문도 환불 가능", async () => {
    const order = await createOrder(basicInput);
    await transitionOrder(order.id, "generating");
    const store = getOrderStore();
    await store.updateOrderStatus(order.id, "review");
    await transitionOrder(order.id, "rejected");
    const refunded = await refundOrder(order.id, "검수 반려 후 재생성 실패");
    expect(refunded.status).toBe("refunded");
  });

  it("published(발송 완료) 주문도 하자·민원 시 환불 가능", async () => {
    const order = await createOrder(basicInput);
    await transitionOrder(order.id, "generating");
    const store = getOrderStore();
    await store.updateOrderStatus(order.id, "review");
    await transitionOrder(order.id, "published");
    const refunded = await refundOrder(order.id, "발송 후 민원 — 환불");
    expect(refunded.status).toBe("refunded");
  });

  it("없는 주문 환불 시 에러", async () => {
    await expect(refundOrder("nonexistent")).rejects.toThrow(/주문 없음/);
  });
});

// ──────────────────────────────────────────────────────────────
// 6. deleteExpiredSubjects — PII 보관기간 만료 삭제
// ──────────────────────────────────────────────────────────────

describe("deleteExpiredSubjects", () => {
  it("보관기간이 지난 Subject만 삭제하고 건수를 반환한다", async () => {
    const store = getOrderStore();

    const order = await createOrder(basicInput);
    const validSubject = await store.getSubject(order.subjectId);
    const { id: _id, createdAt: _createdAt, ...subjectFields } = validSubject!;

    const expiredSubject = await store.createSubject({
      ...subjectFields,
      retainUntil: new Date(Date.now() - 1000).toISOString(), // 이미 만료
    });

    const deletedCount = await store.deleteExpiredSubjects(new Date().toISOString());
    expect(deletedCount).toBe(1);

    expect(await store.getSubject(expiredSubject.id)).toBeNull();
    expect(await store.getSubject(order.subjectId)).not.toBeNull(); // 보관기간 남은 건 유지
  });

  it("만료된 Subject가 없으면 0을 반환한다", async () => {
    const store = getOrderStore();
    await createOrder(basicInput);
    const deletedCount = await store.deleteExpiredSubjects(new Date().toISOString());
    expect(deletedCount).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// 7. 발송 실패 기록·재발송
// ──────────────────────────────────────────────────────────────

/** 발행(published) 상태 + 리포트가 있는 주문을 인메모리 store에 직접 구성한다. */
async function createPublishedOrderWithReport() {
  const store = getOrderStore();
  const order = await createOrder(basicInput);
  await transitionOrder(order.id, "generating");
  const report = await store.createReport({
    orderId: order.id,
    markdown: "# 테스트 리포트",
    html: "<p>테스트</p>",
    tier: "basic",
    reviewStatus: "approved",
    reviewNote: null,
    pdfUrl: null,
  });
  await store.setOrderReport(order.id, report.id);
  await store.updateOrderStatus(order.id, "review");
  await transitionOrder(order.id, "published");
  return { order, report };
}

describe("recordNotifyResult / listNotifyFailures", () => {
  it("실패를 기록하면 notifyError·notifyFailedAt이 채워지고 목록에 나타난다", async () => {
    const store = getOrderStore();
    const { order } = await createPublishedOrderWithReport();

    const updated = await store.recordNotifyResult(order.id, "이메일: SMTP 오류");
    expect(updated.notifyError).toBe("이메일: SMTP 오류");
    expect(updated.notifyFailedAt).toBeTruthy();

    const failures = await store.listNotifyFailures();
    expect(failures.map((o) => o.id)).toContain(order.id);
  });

  it("성공(error=null)을 기록하면 목록에서 빠진다", async () => {
    const store = getOrderStore();
    const { order } = await createPublishedOrderWithReport();

    await store.recordNotifyResult(order.id, "일시 오류");
    await store.recordNotifyResult(order.id, null);

    const failures = await store.listNotifyFailures();
    expect(failures.map((o) => o.id)).not.toContain(order.id);
  });
});

describe("retryNotify", () => {
  it("재발송 성공 시 notifyError가 비워진다", async () => {
    const store = getOrderStore();
    const { order } = await createPublishedOrderWithReport();
    await store.recordNotifyResult(order.id, "이전 실패");

    const result = await retryNotify(order.id);
    expect(result.hasFailure).toBe(false);

    const updated = await store.getOrder(order.id);
    expect(updated!.notifyError).toBeNull();
  });

  it("리포트가 없는 주문은 에러", async () => {
    const order = await createOrder(basicInput); // 아직 paid, reportId 없음
    await expect(retryNotify(order.id)).rejects.toThrow(/발행된 리포트가 없는/);
  });

  it("없는 주문은 에러", async () => {
    await expect(retryNotify("nonexistent")).rejects.toThrow(/주문 없음/);
  });
});
