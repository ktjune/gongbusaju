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

  it("종료 상태에서 전이 불가: published→*", () => {
    expect(canTransition("published", "generating")).toBe(false);
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

  it("Premium은 주소가 없으면 거부", async () => {
    await expect(
      createOrder({ tier: "premium", subject: basicInput.subject })
    ).rejects.toThrow(/주소/);
  });

  it("Premium 주소가 암호화 저장·복원된다", async () => {
    const order = await createOrder({
      tier: "premium",
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
