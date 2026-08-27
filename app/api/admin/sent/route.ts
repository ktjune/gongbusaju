/**
 * GET /api/admin/sent — 발송 완료(published) + 환불(refunded) 주문 목록
 *
 * 어드민이 실제로 리포트가 나간 사람들의 연락처·리포트 링크·발송 상태를 보고,
 * 문제가 있으면 리포트를 열어 검수하거나 환불할 수 있게 한다.
 * 연락처는 PII이므로 middleware 인증(admin) 없이는 응답하지 않는다.
 *
 * 인증: middleware.ts — admin 세션
 */

import { getOrderStore } from "@/lib/orders";
import { classifyPayment } from "@/lib/payments/classify";

export const runtime = "nodejs";

export async function GET() {
  const store = getOrderStore();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const [published, refunded] = await Promise.all([
    store.listOrders({ status: "published" }),
    store.listOrders({ status: "refunded" }),
  ]);

  const orders = [...published, ...refunded].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const items = await Promise.all(
    orders.map(async (o) => {
      // 리포트 토큰 → 결과 페이지 링크 (검수·재확인용)
      let resultUrl: string | null = null;
      if (o.reportId) {
        const report = await store.getReport(o.reportId);
        if (report) resultUrl = `${siteUrl}/result/${report.token}`;
      }
      const payment = classifyPayment(o.paymentKey);
      return {
        id: o.id,
        tier: o.tier,
        status: o.status,
        createdAt: o.createdAt,
        buyerName: o.buyerName, // store가 복호화해서 반환
        contactEmail: o.contactEmail,
        contactPhone: o.contactPhone,
        resultUrl,
        // 발송 결과: notifyError가 있으면 알림 발송 실패, refundedAt은 환불 시각
        notifyError: o.notifyError,
        refundedAt: o.refundedAt,
        hasPayment: !!o.paymentKey,
        // 실제 출금이 있었을 수 있는 결제인지 — PG 테스트 결제도 취소 안내 메일이
        // 자동 발송되므로, 메일만으로는 실환불 여부를 구분할 수 없다
        paymentLabel: payment.label,
        paymentNeedsCare: payment.needsCare,
        refundRequestedAt: o.refundRequestedAt,
      };
    })
  );

  return Response.json({ items });
}
