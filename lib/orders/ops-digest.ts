/**
 * lib/orders/ops-digest.ts
 * 운영 요약 — "오늘 사람이 손대야 할 것"을 한 번에 모은다.
 *
 * 왜 필요한가: 지금까지 장애는 대부분 고객이 연락한 뒤에야 알았다
 * (2026-09-16 주문은 5일). 어드민을 열어야만 보이는 큐들을 매일 아침
 * 에이전트(Claude 루틴)가 읽어 이상이 있을 때만 운영자에게 알리게 한다.
 *
 * [PII] 이 요약은 외부(에이전트·드라이브 기록)로 나간다. 그래서 주문번호·상태·
 * 시각·건수·금액만 담는다. 이름·연락처·생년월일·고객이 쓴 환불 사유·발송 오류
 * 원문(전화번호가 섞일 수 있다)은 넣지 않는다. 자세한 내용은 어드민에서 본다.
 *
 * [읽기 전용] 아무것도 바꾸지 않는다 — 재생성·재발송·환불은 사람이 어드민에서.
 */

import { getOrderStore } from "./store";
import { MAX_GENERATE_ATTEMPTS } from "./generate";
import { UNCONFIRMED_AFTER_HOURS } from "./notify-audit";
import { classifyPayment } from "../payments/classify";
import type { Order, Report } from "./types";
import type { LlmHealth } from "../report/llm-health";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** 자동 복구 크론(/api/worker/run)이 1분마다 집어가므로 이보다 오래 paid면 크론을 의심한다 */
export const STUCK_PAID_AFTER_MS = 15 * MIN;
/** /api/worker/run의 고착 판정과 같은 값 */
export const STUCK_GENERATING_AFTER_MS = 10 * MIN;
/** 검수 대기가 이보다 길면 고객이 기다리고 있다 */
export const REVIEW_WAIT_ALERT_MS = 6 * HOUR;

export type DigestOrder = {
  id: string;
  status: Order["status"];
  createdAt: string;
  updatedAt: string;
  generateAttempts: number;
};

export type OpsDigest = {
  generatedAt: string;
  /** true = 사람이 손댈 것이 없다 */
  ok: boolean;
  /** 사람이 읽을 경보 문장 — 비어 있으면 정상 */
  alerts: string[];
  stuck: {
    /** 결제됐는데 제작이 시작되지 않음 */
    paid: DigestOrder[];
    /** 제작 중 멈춤 */
    generating: DigestOrder[];
    /** 생성 실패 — 자동 재시도 대기 */
    failedRetrying: DigestOrder[];
    /** 생성 실패 — 재시도 상한 도달, 사람이 봐야 함 */
    failedExhausted: DigestOrder[];
    /** 검수 반려 — 재생성 필요 */
    rejected: DigestOrder[];
  };
  review: { pending: number; oldestWaitHours: number | null };
  notify: {
    /** 발송 실패 큐 */
    failed: { id: string; failedAt: string | null }[];
    /** 발행 후 수신 확인이 없는 건 (notify-audit가 아직 알리지 않은 것) */
    unconfirmed: string[];
  };
  refundRequests: { id: string; status: Order["status"]; requestedAt: string | null }[];
  /** 어제(KST) 실적 — PG 테스트·모의 결제 제외 */
  yesterday: { date: string; orders: number; paidKrw: number; refunded: number };
};

/** KST 기준 YYYY-MM-DD */
export function kstDate(d: Date): string {
  return new Date(d.getTime() + 9 * HOUR).toISOString().slice(0, 10);
}

const toDigest = (o: Order): DigestOrder => ({
  id: o.id,
  status: o.status,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  generateAttempts: o.generateAttempts,
});

const ageMs = (iso: string, now: Date) => now.getTime() - new Date(iso).getTime();

export type OpsDigestInput = {
  orders: Order[];
  pendingReports: Report[];
  notifyFailures: Order[];
  unconfirmed: Order[];
  refundRequests: Order[];
};

/** 순수 함수 — 스토어 없이 테스트할 수 있게 집계만 한다. */
export function summarizeOps(input: OpsDigestInput, now: Date = new Date()): OpsDigest {
  const { orders } = input;
  const byStatus = (s: Order["status"]) => orders.filter((o) => o.status === s);

  const paid = byStatus("paid").filter((o) => ageMs(o.updatedAt, now) > STUCK_PAID_AFTER_MS);
  const generating = byStatus("generating").filter(
    (o) => ageMs(o.updatedAt, now) > STUCK_GENERATING_AFTER_MS
  );
  const failed = byStatus("failed");
  const failedExhausted = failed.filter((o) => o.generateAttempts >= MAX_GENERATE_ATTEMPTS);
  const failedRetrying = failed.filter((o) => o.generateAttempts < MAX_GENERATE_ATTEMPTS);
  const rejected = byStatus("rejected");

  const oldestPending = input.pendingReports.reduce<number | null>((max, r) => {
    const a = ageMs(r.createdAt, now);
    return max == null || a > max ? a : max;
  }, null);

  const yDate = kstDate(new Date(now.getTime() - 24 * HOUR));
  const yOrders = orders.filter((o) => kstDate(new Date(o.createdAt)) === yDate);
  const yPaid = yOrders.filter((o) => {
    if (o.amountKrw == null) return false;
    const kind = classifyPayment(o.paymentKey).kind;
    return kind !== "test" && kind !== "none";
  });

  const alerts: string[] = [];
  if (paid.length)
    alerts.push(
      `결제 후 제작이 시작되지 않은 주문 ${paid.length}건 — 자동 복구 크론(cron-job.org)이 돌고 있는지 확인`
    );
  if (generating.length) alerts.push(`제작 중 멈춘 주문 ${generating.length}건`);
  if (failedExhausted.length)
    alerts.push(
      `재시도 ${MAX_GENERATE_ATTEMPTS}회를 다 쓴 실패 주문 ${failedExhausted.length}건 — 어드민 재생성 큐에서 직접 처리`
    );
  if (rejected.length) alerts.push(`검수 반려 후 재생성 대기 ${rejected.length}건`);
  if (oldestPending != null && oldestPending > REVIEW_WAIT_ALERT_MS)
    alerts.push(
      `검수 대기 ${input.pendingReports.length}건, 가장 오래된 건 ${Math.floor(oldestPending / HOUR)}시간째`
    );
  if (input.notifyFailures.length)
    alerts.push(`결과 링크 발송 실패 ${input.notifyFailures.length}건 — 어드민에서 재발송`);
  if (input.unconfirmed.length)
    alerts.push(
      `발행 ${UNCONFIRMED_AFTER_HOURS}시간이 지나도 수신 확인이 없는 주문 ${input.unconfirmed.length}건`
    );
  if (input.refundRequests.length)
    alerts.push(`처리 대기 중인 환불 요청 ${input.refundRequests.length}건`);

  return {
    generatedAt: now.toISOString(),
    ok: alerts.length === 0,
    alerts,
    stuck: {
      paid: paid.map(toDigest),
      generating: generating.map(toDigest),
      failedRetrying: failedRetrying.map(toDigest),
      failedExhausted: failedExhausted.map(toDigest),
      rejected: rejected.map(toDigest),
    },
    review: {
      pending: input.pendingReports.length,
      oldestWaitHours: oldestPending == null ? null : Math.floor(oldestPending / HOUR),
    },
    notify: {
      failed: input.notifyFailures.map((o) => ({ id: o.id, failedAt: o.notifyFailedAt })),
      unconfirmed: input.unconfirmed.map((o) => o.id),
    },
    refundRequests: input.refundRequests.map((o) => ({
      id: o.id,
      status: o.status,
      requestedAt: o.refundRequestedAt,
    })),
    yesterday: {
      date: yDate,
      orders: yOrders.length,
      paidKrw: yPaid.filter((o) => !o.refundedAt).reduce((a, o) => a + (o.amountKrw ?? 0), 0),
      refunded: yPaid.filter((o) => o.refundedAt).length,
    },
  };
}

export async function buildOpsDigest(now: Date = new Date()): Promise<OpsDigest> {
  const store = getOrderStore();
  const [orders, pendingReports, notifyFailures, unconfirmed, refundRequests] =
    await Promise.all([
      store.listOrders(),
      store.listReports({ reviewStatus: "pending" }),
      store.listNotifyFailures(),
      store.listUnconfirmedNotifies(new Date(now.getTime() - UNCONFIRMED_AFTER_HOURS * HOUR)),
      store.listRefundRequests(),
    ]);
  return summarizeOps(
    { orders, pendingReports, notifyFailures, unconfirmed, refundRequests },
    now
  );
}

/** LLM 점검 결과를 경보에 합친다 — 주력 장애는 가장 급하므로 맨 앞에. */
export function withLlmAlerts(alerts: string[], llm: LlmHealth | null | undefined): string[] {
  const merged = [...alerts];
  if (llm?.note && !llm.primaryOk) merged.unshift(`AI 공급자 장애: ${llm.note}`);
  else if (llm?.note) merged.push(`AI 폴백 점검: ${llm.note}`);
  return merged;
}

/** 운영자 메일 제목·본문. 주문번호는 어드민에서 찾아볼 수 있게 함께 적는다. */
export function formatDigestAlert(
  digest: OpsDigest,
  alerts: string[]
): { subject: string; body: string } {
  const ids = [
    ...digest.stuck.paid,
    ...digest.stuck.generating,
    ...digest.stuck.failedExhausted,
    ...digest.stuck.rejected,
  ].map((o) => o.id);
  ids.push(...digest.notify.failed.map((o) => o.id), ...digest.notify.unconfirmed);
  ids.push(...digest.refundRequests.map((o) => o.id));
  const uniq = [...new Set(ids)];

  return {
    subject: `아침 점검 — 확인할 것 ${alerts.length}건`,
    body:
      alerts.map((a) => `• ${a}`).join("\n") +
      (uniq.length ? `\n\n관련 주문: ${uniq.join(", ")}` : "") +
      `\n\n어제(${digest.yesterday.date}) 주문 ${digest.yesterday.orders}건 · 실매출 ${digest.yesterday.paidKrw.toLocaleString("ko-KR")}원`,
  };
}
