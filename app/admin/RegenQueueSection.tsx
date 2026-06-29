"use client";

import { S } from "./styles";

export type RegenOrderItem = {
  id: string;
  tier: string;
  status: string;
  createdAt: string;
  hasPayment: boolean;
};

export function RegenQueueSection({
  orders,
  loading,
  busy,
  onRegenerate,
  onRefund,
}: {
  orders: RegenOrderItem[];
  loading: boolean;
  busy: string | null;
  onRegenerate: (orderId: string) => void;
  onRefund: (orderId: string, hasPayment: boolean) => void;
}) {
  return (
    <>
      <h2 style={S.section}>재생성 대기</h2>
      <p style={S.sub}>반려됨·생성 오류 {orders.length}건</p>
      {!loading && orders.length === 0 ? (
        <div style={S.empty}>재생성 대기 중인 주문이 없습니다.</div>
      ) : (
        !loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요금제</th>
                <th style={S.th}>상태</th>
                <th style={S.th}>접수</th>
                <th style={S.th}>재생성</th>
                <th style={S.th}>환불</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => (
                <tr key={ord.id}>
                  <td style={S.td}>
                    <span style={ord.tier === "premium" ? S.chipP : S.chipB}>{ord.tier}</span>
                  </td>
                  <td style={S.td}>
                    <span style={ord.status === "rejected" ? S.statusRej : S.statusFail}>
                      {ord.status === "rejected" ? "반려됨" : "생성 오류"}
                    </span>
                  </td>
                  <td style={S.td}>{new Date(ord.createdAt).toLocaleString("ko-KR")}</td>
                  <td style={S.td}>
                    <button
                      style={S.approve}
                      disabled={busy === ord.id}
                      onClick={() => onRegenerate(ord.id)}
                    >
                      {busy === ord.id ? "처리 중…" : "재생성"}
                    </button>
                  </td>
                  <td style={S.td}>
                    <button
                      style={S.reject}
                      disabled={busy === ord.id}
                      onClick={() => onRefund(ord.id, ord.hasPayment)}
                    >
                      환불
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
