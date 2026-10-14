/**
 * lib/orders/ops-digest — 운영 요약
 *
 * 운영 감시 에이전트가 매일 읽는다. 사람이 손댈 것만 경보로 올리고,
 * 외부로 나가는 요약에 개인정보가 섞이지 않아야 한다.
 */

import { describe, it, expect } from "vitest";
import {
  summarizeOps,
  kstDate,
  withLlmAlerts,
  formatDigestAlert,
  type OpsDigestInput,
} from "../ops-digest";
import type { LlmHealth } from "../../report/llm-health";
import { MAX_GENERATE_ATTEMPTS } from "../generate";
import type { Order, Report } from "../types";

const NOW = new Date("2026-10-14T00:00:00Z"); // KST 09:00
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function order(over: Partial<Order> = {}): Order {
  return {
    id: "o1",
    tier: "basic",
    status: "published",
    subjectId: "s1",
    reportId: null,
    userId: null,
    paymentKey: null,
    refundedAt: null,
    refundReason: null,
    refundRequestedAt: null,
    refundRequestReason: null,
    notifyError: null,
    notifyFailedAt: null,
    notifyDeliveredAt: null,
    notifyAuditedAt: null,
    generateAttempts: 1,
    buyerName: "홍길동",
    contactEmail: "parent@example.com",
    contactPhone: "010-1234-5678",
    amountKrw: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    referrer: null,
    landingPath: null,
    createdAt: ago(2 * HOUR),
    updatedAt: ago(2 * HOUR),
    ...over,
  };
}

const empty: OpsDigestInput = {
  orders: [],
  pendingReports: [],
  notifyFailures: [],
  unconfirmed: [],
  refundRequests: [],
};

describe("summarizeOps", () => {
  it("손댈 것이 없으면 ok이고 경보가 없다", () => {
    const d = summarizeOps({ ...empty, orders: [order()] }, NOW);
    expect(d.ok).toBe(true);
    expect(d.alerts).toEqual([]);
  });

  it("방금 결제된 주문은 멈춘 것으로 보지 않는다 — 크론이 집어갈 시간을 준다", () => {
    const d = summarizeOps(
      { ...empty, orders: [order({ status: "paid", updatedAt: ago(5 * MIN) })] },
      NOW
    );
    expect(d.stuck.paid).toEqual([]);
    expect(d.ok).toBe(true);
  });

  it("15분 넘게 paid에 머문 주문은 크론 고장 신호로 올린다", () => {
    const d = summarizeOps(
      { ...empty, orders: [order({ id: "p1", status: "paid", updatedAt: ago(30 * MIN) })] },
      NOW
    );
    expect(d.stuck.paid.map((o) => o.id)).toEqual(["p1"]);
    expect(d.ok).toBe(false);
    expect(d.alerts[0]).toContain("크론");
  });

  it("실패 주문은 재시도 상한 도달 여부로 나눠, 상한 도달만 경보한다", () => {
    const d = summarizeOps(
      {
        ...empty,
        orders: [
          order({ id: "f1", status: "failed", generateAttempts: 2 }),
          order({ id: "f2", status: "failed", generateAttempts: MAX_GENERATE_ATTEMPTS }),
        ],
      },
      NOW
    );
    expect(d.stuck.failedRetrying.map((o) => o.id)).toEqual(["f1"]);
    expect(d.stuck.failedExhausted.map((o) => o.id)).toEqual(["f2"]);
    expect(d.alerts).toHaveLength(1);
  });

  it("검수 대기는 6시간이 넘었을 때만 경보한다", () => {
    const report = (h: number) => ({ id: `r${h}`, createdAt: ago(h * HOUR) }) as Report;
    expect(summarizeOps({ ...empty, pendingReports: [report(2)] }, NOW).ok).toBe(true);
    const late = summarizeOps({ ...empty, pendingReports: [report(2), report(8)] }, NOW);
    expect(late.review).toEqual({ pending: 2, oldestWaitHours: 8 });
    expect(late.ok).toBe(false);
  });

  it("발송 실패·수신 미확인·환불 요청을 각각 경보한다", () => {
    const d = summarizeOps(
      {
        ...empty,
        notifyFailures: [order({ id: "n1", notifyError: "010-1234-5678 수신거부" })],
        unconfirmed: [order({ id: "u1" })],
        refundRequests: [order({ id: "rr1", refundRequestReason: "아이 이름 홍길순 오기" })],
      },
      NOW
    );
    expect(d.alerts).toHaveLength(3);
    expect(d.notify.unconfirmed).toEqual(["u1"]);
  });

  it("요약에 개인정보(이름·연락처·환불 사유·발송 오류 원문)가 섞이지 않는다", () => {
    const d = summarizeOps(
      {
        orders: [order({ status: "failed" }), order({ status: "rejected" })],
        pendingReports: [],
        notifyFailures: [order({ notifyError: "010-1234-5678 수신거부" })],
        unconfirmed: [order()],
        refundRequests: [order({ refundRequestReason: "아이 이름 홍길순 오기" })],
      },
      NOW
    );
    const json = JSON.stringify(d);
    for (const pii of ["홍길동", "홍길순", "parent@example.com", "010-1234-5678"]) {
      expect(json).not.toContain(pii);
    }
  });

  it("어제(KST) 실적은 실결제만 세고 환불은 매출에서 뺀다", () => {
    // NOW = 10-14 09:00 KST → 어제 = 10-13 KST
    const yesterdayKst = "2026-10-13T03:00:00Z"; // 10-13 12:00 KST
    const d = summarizeOps(
      {
        ...empty,
        orders: [
          order({ id: "a", createdAt: yesterdayKst, paymentKey: "gbg_1", amountKrw: 9900 }),
          order({
            id: "b",
            createdAt: yesterdayKst,
            paymentKey: "gbg_2",
            amountKrw: 9900,
            refundedAt: ago(HOUR),
          }),
          // PG 테스트 결제 — 매출 아님
          order({ id: "c", createdAt: yesterdayKst, paymentKey: "tgen_x", amountKrw: 9900 }),
          // 오늘 주문 — 어제 실적 아님
          order({ id: "d", createdAt: ago(HOUR), paymentKey: "gbg_3", amountKrw: 9900 }),
        ],
      },
      NOW
    );
    expect(d.yesterday).toEqual({ date: "2026-10-13", orders: 3, paidKrw: 9900, refunded: 1 });
  });

  it("kstDate는 UTC 15시 이후를 다음 날로 본다", () => {
    expect(kstDate(new Date("2026-10-13T14:59:00Z"))).toBe("2026-10-13");
    expect(kstDate(new Date("2026-10-13T15:00:00Z"))).toBe("2026-10-14");
  });
});

describe("withLlmAlerts", () => {
  const health = (over: Partial<LlmHealth>): LlmHealth => ({
    providers: [],
    primaryOk: true,
    hasFallback: true,
    fallbackOk: true,
    note: null,
    ...over,
  });

  it("주력 장애는 맨 앞, 폴백 문제는 맨 뒤에 붙는다", () => {
    expect(withLlmAlerts(["x"], health({ primaryOk: false, note: "죽음" }))[0]).toContain("장애");
    expect(withLlmAlerts(["x"], health({ fallbackOk: false, note: "폴백" }))).toEqual([
      "x",
      "AI 폴백 점검: 폴백",
    ]);
  });

  it("정상이거나 키가 없으면 그대로", () => {
    expect(withLlmAlerts(["x"], health({}))).toEqual(["x"]);
    expect(withLlmAlerts([], null)).toEqual([]);
  });
});

describe("formatDigestAlert", () => {
  it("경보·관련 주문번호·어제 실적을 담고 개인정보는 담지 않는다", () => {
    const d = summarizeOps(
      {
        ...empty,
        orders: [order({ id: "f9", status: "failed", generateAttempts: MAX_GENERATE_ATTEMPTS })],
        refundRequests: [order({ id: "rr1", refundRequestReason: "아이 이름 홍길순 오기" })],
      },
      NOW
    );
    const { subject, body } = formatDigestAlert(d, d.alerts);
    expect(subject).toContain("2건");
    expect(body).toContain("f9");
    expect(body).toContain("rr1");
    expect(body).toContain("2026-10-13");
    for (const pii of ["홍길동", "홍길순", "parent@example.com", "010-1234-5678"]) {
      expect(body).not.toContain(pii);
    }
  });
});
