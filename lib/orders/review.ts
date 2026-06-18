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

  // 승인 후 보호자에게 결과 링크 발송 (실패해도 메인 플로우 무관)
  const order = await store.getOrder(report.orderId);
  if (order) {
    sendResultLink({
      orderId: order.id,
      resultUrl: buildResultUrl(report.token),
      contactEmail: order.contactEmail,
      contactPhone: order.contactPhone,
    }).catch((err) => {
      console.error("[notify] 발송 중 오류:", err);
    });
  }

  return updated;
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
