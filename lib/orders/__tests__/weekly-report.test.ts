/**
 * lib/orders/weekly-report — 주간 경영 리포트
 */

import { describe, it, expect } from "vitest";
import { summarizeWeeks, isKstMonday, formatWeeklyReport } from "../weekly-report";
import type { Order } from "../types";

// 2026-10-19(월) 08:50 KST
const NOW = new Date("2026-10-18T23:50:00Z");

function order(over: Partial<Order>): Order {
  return {
    id: "o",
    tier: "basic",
    status: "published",
    subjectId: "s",
    reportId: null,
    userId: null,
    paymentKey: "gbg_1",
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
    amountKrw: 9900,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    referrer: null,
    landingPath: null,
    createdAt: "2026-10-14T03:00:00Z",
    updatedAt: "2026-10-14T03:00:00Z",
    ...over,
  };
}

describe("summarizeWeeks", () => {
  it("지난주(월~일 KST)와 그 전주를 나눠 센다", () => {
    const r = summarizeWeeks(
      [
        // 지난주 월요일 00:10 KST = 일요일 15:10 UTC — 경계 안쪽
        order({ id: "a", createdAt: "2026-10-11T15:10:00Z", utmSource: "threads" }),
        // 지난주 일요일 23:50 KST — 경계 안쪽
        order({ id: "b", createdAt: "2026-10-18T14:50:00Z", utmSource: "threads" }),
        // 지난주, 환불
        order({ id: "c", createdAt: "2026-10-14T03:00:00Z", refundedAt: "2026-10-15T00:00:00Z" }),
        // 지난주, PG 테스트 — 매출 아님
        order({ id: "d", createdAt: "2026-10-14T03:00:00Z", paymentKey: "tgen_x" }),
        // 전주
        order({ id: "e", createdAt: "2026-10-08T03:00:00Z" }),
        // 이번 주(오늘) — 어디에도 안 들어감
        order({ id: "f", createdAt: "2026-10-18T23:00:00Z" }),
      ],
      NOW
    );
    expect(r.last.from).toBe("2026-10-12");
    expect(r.last.to).toBe("2026-10-18");
    expect(r.last.paid).toBe(3);
    expect(r.last.refunded).toBe(1);
    expect(r.last.netKrw).toBe(19800);
    expect(r.last.aiRuns).toBe(4); // 테스트 결제 주문도 생성은 돌았다
    expect(r.last.topChannels[0]).toEqual({ name: "threads", count: 2, krw: 19800 });
    expect(r.prev.paid).toBe(1);
  });
});

describe("isKstMonday", () => {
  it("UTC 일요일 밤이 KST 월요일 아침이다", () => {
    expect(isKstMonday(NOW)).toBe(true);
    expect(isKstMonday(new Date("2026-10-19T23:50:00Z"))).toBe(false);
  });
});

describe("formatWeeklyReport", () => {
  it("전주 대비 증감을 쓰고 개인정보는 담지 않는다", () => {
    const r = summarizeWeeks(
      [
        order({ id: "a", createdAt: "2026-10-14T03:00:00Z" }),
        order({ id: "b", createdAt: "2026-10-15T03:00:00Z" }),
        order({ id: "e", createdAt: "2026-10-08T03:00:00Z" }),
      ],
      NOW
    );
    const { subject, body } = formatWeeklyReport(r);
    expect(subject).toContain("19,800원");
    expect(body).toContain("전주 대비 +9,900원");
    for (const pii of ["홍길동", "parent@example.com", "010-1234-5678"]) {
      expect(body).not.toContain(pii);
    }
  });
});
