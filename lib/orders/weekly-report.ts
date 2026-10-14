/**
 * lib/orders/weekly-report.ts
 * 주간 경영 리포트 — 지난주(월~일, KST) 실적을 그 전주와 나란히 놓는다.
 *
 * 월요일 아침 운영 점검 크론(/api/worker/notify-audit)이 메일 한 통으로 보낸다.
 * 매출 기준은 어드민 매출 화면(/api/admin/revenue)과 같다: 실제 돈이 오간 결제만
 * (PG 테스트·모의 결제 제외), 환불 건은 매출에서 뺀다.
 *
 * [PII] 메일로 나가므로 건수·금액·유입 채널(캠페인명·도메인)만 담는다.
 */

import { describeChannel } from "../attribution";
import { classifyPayment } from "../payments/classify";
import { kstDate } from "./ops-digest";
import type { Order } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export type WeekStats = {
  /** KST 기준 월요일~일요일 */
  from: string;
  to: string;
  /** 실결제 건수 (환불 포함) */
  paid: number;
  refunded: number;
  /** 환불을 뺀 실매출 */
  netKrw: number;
  /** 리포트 생성 실행 횟수(재시도 포함) — AI 비용의 근거 */
  aiRuns: number;
  /** 매출 기준 상위 유입 채널 */
  topChannels: { name: string; count: number; krw: number }[];
};

export type WeeklyReport = { last: WeekStats; prev: WeekStats };

/** now가 속한 주의 월요일(KST) 00:00을 UTC Date로 */
function kstMonday(now: Date): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0 … 일=6
  const mondayKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - dow * DAY;
  return new Date(mondayKst - 9 * 60 * 60 * 1000);
}

function isRealPayment(o: Order): boolean {
  if (o.amountKrw == null) return false;
  const kind = classifyPayment(o.paymentKey).kind;
  return kind !== "test" && kind !== "none";
}

function weekStats(orders: Order[], start: Date): WeekStats {
  const end = new Date(start.getTime() + 7 * DAY);
  const inWeek = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  const paid = inWeek.filter(isRealPayment);

  const channels = new Map<string, { count: number; krw: number }>();
  for (const o of paid) {
    if (o.refundedAt) continue; // 환불 건은 채널 성과에서 뺀다 — 광고 판단이 부풀려진다
    const name = describeChannel(o);
    const c = channels.get(name) ?? { count: 0, krw: 0 };
    c.count += 1;
    c.krw += o.amountKrw ?? 0;
    channels.set(name, c);
  }

  return {
    from: kstDate(start),
    to: kstDate(new Date(end.getTime() - 1)),
    paid: paid.length,
    refunded: paid.filter((o) => o.refundedAt).length,
    netKrw: paid.filter((o) => !o.refundedAt).reduce((a, o) => a + (o.amountKrw ?? 0), 0),
    aiRuns: inWeek.reduce((a, o) => a + o.generateAttempts, 0),
    topChannels: [...channels.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.krw - a.krw || b.count - a.count)
      .slice(0, 5),
  };
}

export function summarizeWeeks(orders: Order[], now: Date = new Date()): WeeklyReport {
  const thisMonday = kstMonday(now);
  return {
    last: weekStats(orders, new Date(thisMonday.getTime() - 7 * DAY)),
    prev: weekStats(orders, new Date(thisMonday.getTime() - 14 * DAY)),
  };
}

/** 오늘이 KST 월요일인가 — 주간 리포트는 월요일 아침에만 보낸다 */
export function isKstMonday(now: Date = new Date()): boolean {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay() === 1;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function delta(cur: number, prev: number, fmt: (n: number) => string): string {
  if (cur === prev) return "변화 없음";
  const sign = cur > prev ? "+" : "−";
  return `전주 대비 ${sign}${fmt(Math.abs(cur - prev))}`;
}

export function formatWeeklyReport(r: WeeklyReport): { subject: string; body: string } {
  const { last, prev } = r;
  const lines = [
    `기간: ${last.from} ~ ${last.to}`,
    "",
    `• 실매출 ${won(last.netKrw)} (${delta(last.netKrw, prev.netKrw, won)})`,
    `• 결제 ${last.paid}건 (${delta(last.paid, prev.paid, (n) => `${n}건`)})`,
    `• 환불 ${last.refunded}건`,
    `• AI 리포트 생성 실행 ${last.aiRuns}회 — 결제 건수보다 많이 늘면 재시도가 잦다는 뜻`,
    "",
    "유입 채널 (매출순):",
    ...(last.topChannels.length
      ? last.topChannels.map((c) => `  - ${c.name}: ${c.count}건 · ${won(c.krw)}`)
      : ["  - 결제 없음"]),
  ];
  return {
    subject: `주간 리포트 ${last.from}~${last.to} — 실매출 ${won(last.netKrw)}`,
    body: lines.join("\n"),
  };
}
