/**
 * POST /api/generate-trigger
 * 주문 → 리포트 생성 (paid → generating → review).
 *
 * [데모] 신청 직후 폼이 호출해 생성을 시작한다. 실서비스에서는 결제 웹훅 또는
 * 비동기 잡 큐(workers)가 트리거하고, 생성은 검수(review) 대기로 끝난다.
 *
 * Node 런타임 필수 (crypto·fs·LLM).
 */

import { getOrderStore, generateReportForOrder, isGeneratable } from "@/lib/orders";
import { GuardrailError } from "@/lib/report";

export const runtime = "nodejs";
export const maxDuration = 60; // LLM 생성 여유

export async function POST(req: Request) {
  let orderId: string;
  try {
    const body = (await req.json()) as { orderId?: string };
    if (!body.orderId) throw new Error();
    orderId = body.orderId;
  } catch {
    return Response.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) {
    return Response.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!isGeneratable(order)) {
    return Response.json(
      { error: `생성 가능 상태가 아닙니다 (현재: ${order.status}).` },
      { status: 409 }
    );
  }

  try {
    const report = await generateReportForOrder(orderId);
    return Response.json(
      { reportId: report.id, token: report.token, reviewStatus: report.reviewStatus },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof GuardrailError) {
      // 금지 표현 감지 — 발행 차단됨 (검수자에게 알릴 사안)
      return Response.json(
        { error: "리포트 검수 규칙 위반으로 생성이 보류되었습니다.", violations: e.violations },
        { status: 422 }
      );
    }
    const msg = e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
