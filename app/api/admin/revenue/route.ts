/**
 * GET /api/admin/revenue — 매출 집계 (건수·금액·유입 채널)
 *
 * 왜 GA4를 안 쓰나: GA4 표준 보고서는 확정에 24~48시간이 걸리고, 환불을 반영하지 않는다.
 * 실제로 환불된 검증 결제 2건이 GA4에 매출로 남아 실매출과 2배 차이가 났다.
 * 매출은 우리 DB가 유일한 진실이다.
 *
 * 집계 대상은 **실제 돈이 오간 주문**뿐이다 — paymentKey가 있고 amountKrw가 채워진 건.
 * 모의 결제(로컬 개발)는 amountKrw가 null이라 자연히 빠진다.
 *
 * 인증: middleware.ts — 어드민 세션 쿠키
 */

import { getPrisma } from "@/lib/db";
import { describeChannel, UNKNOWN_CHANNEL } from "@/lib/attribution";
import { classifyPayment } from "@/lib/payments/classify";

export const runtime = "nodejs";

type Row = {
  paymentKey: string | null;
  amountKrw: number | null;
  refundedAt: Date | null;
  createdAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  landingPath: string | null;
};

/** KST 기준 YYYY-MM-DD. createdAt은 타임존 없는 컬럼에 UTC로 저장돼 있다. */
function kstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET() {
  const db = getPrisma();

  const allRows = (await db.order.findMany({
    where: { paymentKey: { not: null }, amountKrw: { not: null } },
    select: {
      paymentKey: true,
      amountKrw: true,
      refundedAt: true,
      createdAt: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      referrer: true,
      landingPath: true,
    },
    orderBy: { createdAt: "desc" },
  })) as Row[];

  // PG 테스트 결제(tgen_…)는 승인·취소가 다 되지만 실제 출금이 없다.
  // 이걸 매출로 세면 사장님이 직접 돌린 검증 18건이 그대로 매출로 잡힌다
  // (실제로 그렇게 잡혀 198,000원으로 보였다 — 진짜 매출은 29,700원이었다).
  const rows = allRows.filter((r) => {
    const kind = classifyPayment(r.paymentKey).kind;
    return kind !== "test" && kind !== "none";
  });

  let grossKrw = 0;
  let refundedKrw = 0;
  let refundedCount = 0;
  const byChannel = new Map<string, { count: number; krw: number; refunded: number }>();
  const byDay = new Map<string, { count: number; krw: number }>();
  const byLanding = new Map<string, { count: number; krw: number }>();

  for (const r of rows) {
    const amt = r.amountKrw ?? 0;
    grossKrw += amt;
    if (r.refundedAt) {
      refundedKrw += amt;
      refundedCount += 1;
      // 환불된 건은 채널 성과에서 매출로 세지 않는다 — 광고 판단이 부풀려진다
    }

    const ch = describeChannel(r);
    const c = byChannel.get(ch) ?? { count: 0, krw: 0, refunded: 0 };
    c.count += 1;
    if (r.refundedAt) c.refunded += 1;
    else c.krw += amt;
    byChannel.set(ch, c);

    const day = kstDate(r.createdAt);
    const d = byDay.get(day) ?? { count: 0, krw: 0 };
    d.count += 1;
    if (!r.refundedAt) d.krw += amt;
    byDay.set(day, d);

    const lp = r.landingPath ?? UNKNOWN_CHANNEL;
    const l = byLanding.get(lp) ?? { count: 0, krw: 0 };
    l.count += 1;
    if (!r.refundedAt) l.krw += amt;
    byLanding.set(lp, l);
  }

  const sortByKrw = <T extends { krw: number; count: number }>(m: Map<string, T>) =>
    [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.krw - a.krw || b.count - a.count);

  return Response.json({
    total: {
      count: rows.length,
      grossKrw,
      refundedCount,
      refundedKrw,
      /** 환불을 뺀 실매출 — 이 숫자가 통장에 남는 금액이다 */
      netKrw: grossKrw - refundedKrw,
    },
    byChannel: sortByKrw(byChannel),
    byLanding: sortByKrw(byLanding),
    // 최근 14일만 — 그보다 오래된 일자별 추이는 이 화면에서 볼 일이 없다
    byDay: [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 14),
  });
}
