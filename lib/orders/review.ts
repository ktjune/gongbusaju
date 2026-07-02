/**
 * lib/orders/review.ts
 * 검수 액션 — 리포트 승인/반려 (SPEC §3 검수 단계)
 *
 * 승인: reviewStatus=approved + 주문 review→published (결과페이지 공개)
 * 반려: reviewStatus=rejected + 주문 review→rejected (재생성 대상)
 */

import { getOrderStore } from "./store";
import { transitionOrder } from "./index";
import type { Report } from "./types";
import { sendResultLink, buildResultUrl } from "../notify";

/** 리포트를 승인하고 주문을 발행 상태로 전이한다. */
export async function approveReport(reportId: string): Promise<Report> {
  const store = getOrderStore();
  const report = await store.getReport(reportId);
  if (!report) throw new Error(`리포트 없음: ${reportId}`);

  const updated = await store.updateReport(reportId, {
    reviewStatus: "approved",
    reviewNote: null,
  });
  await transitionOrder(report.orderId, "published");

  // 승인 후 보호자에게 결과 링크 발송.
  // 반드시 await — Vercel 서버리스는 응답 반환 즉시 프로세스가 동결되므로
  // fire-and-forget 프라미스는 실행되지 못하고 메일이 발송되지 않는다.
  // (sendResultLink는 절대 throw하지 않음 — 실패는 outcome으로 반환)
  const order = await store.getOrder(report.orderId);
  if (order) {
    try {
      const outcome = await sendResultLink({
        orderId: order.id,
        resultUrl: buildResultUrl(report.token),
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone,
      });
      await store.recordNotifyResult(order.id, outcome.hasFailure ? outcome.error : null);
    } catch (err) {
      console.error("[notify] 발송 처리 중 예외:", err);
    }
  }

  return updated;
}

/** 발송 실패가 기록된 주문에 결과 링크를 재발송한다. */
export async function retryNotify(orderId: string): Promise<{ hasFailure: boolean }> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);
  if (!order.reportId) throw new Error(`발행된 리포트가 없는 주문입니다: ${orderId}`);

  const report = await store.getReport(order.reportId);
  if (!report) throw new Error(`리포트 없음: ${order.reportId}`);

  const outcome = await sendResultLink({
    orderId: order.id,
    resultUrl: buildResultUrl(report.token),
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
  });

  await store.recordNotifyResult(order.id, outcome.hasFailure ? outcome.error : null);
  return { hasFailure: outcome.hasFailure };
}

/** 리포트를 반려하고 주문을 재생성 대상으로 전이한다. */
export async function rejectReport(
  reportId: string,
  note: string
): Promise<Report> {
  const store = getOrderStore();
  const report = await store.getReport(reportId);
  if (!report) throw new Error(`리포트 없음: ${reportId}`);

  const updated = await store.updateReport(reportId, {
    reviewStatus: "rejected",
    reviewNote: note || "사유 미기재",
  });
  await transitionOrder(report.orderId, "rejected");
  return updated;
}

/** 검수 대기(pending) 리포트 목록 */
export async function listPendingReports(): Promise<Report[]> {
  return getOrderStore().listReports({ reviewStatus: "pending" });
}
