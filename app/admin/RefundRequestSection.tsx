"use client";

import { S } from "./styles";

export type RefundRequestItem = {
  id: string;
  status: string;
  createdAt: string;
  refundRequestedAt: string | null;
  refundRequestReason: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  paymentLabel: string;
  paymentNeedsCare: boolean;
};

/** 주문 상태 → 화면 라벨 */
const STATUS_LABEL: Record<string, string> = {
  paid: "결제됨",
  generating: "생성 중",
  review: "검수 대기",
  published: "발송 완료",
  rejected: "반려됨",
  failed: "생성 오류",
};

export function RefundRequestSection({
  items,
  loading,
  busy,
  onRefund,
}: {
  items: RefundRequestItem[];
  loading: boolean;
  busy: string | null;
  onRefund: (orderId: string, paymentLabel: string, needsCare: boolean) => void;
}) {
  return (
    <>
      <h2 style={S.section}>환불 요청</h2>
      <p style={S.sub}>
        고객이 /refund 에서 접수한 요청 {items.length}건 · 검토 후 처리
      </p>
      {!loading && items.length === 0 ? (
        <div style={S.empty}>접수된 환불 요청이 없습니다.</div>
      ) : (
        !loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요청일</th>
                <th style={S.th}>연락처</th>
                <th style={S.th}>사유</th>
                <th style={S.th}>주문 상태</th>
                <th style={S.th}>결제</th>
                <th style={S.th}>처리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td style={S.td}>
                    {o.refundRequestedAt
                      ? new Date(o.refundRequestedAt).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: 12 }}>{o.contactEmail ?? "-"}</div>
                    <div style={{ fontSize: 12, color: "#9a9fa8" }}>
                      {o.contactPhone ?? ""}
                    </div>
                  </td>
                  <td style={S.td}>{o.refundRequestReason ?? "-"}</td>
                  <td style={S.td}>
                    <span style={S.chipB}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  </td>
                  <td style={S.td}>
                    <span style={o.paymentNeedsCare ? S.statusRej : S.chipB}>
                      {o.paymentLabel}
                    </span>
                  </td>
                  <td style={S.td}>
                    <button
                      style={S.reject}
                      disabled={busy === o.id}
                      onClick={() => onRefund(o.id, o.paymentLabel, o.paymentNeedsCare)}
                    >
                      {busy === o.id ? "처리 중…" : "환불 실행"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </>
  );
}
