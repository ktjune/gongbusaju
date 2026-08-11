"use client";

import { S } from "./styles";

export type RegenOrderItem = {
  id: string;
  tier: string;
  status: string;
  createdAt: string;
  hasPayment: boolean;
  paymentLabel: string;
  paymentNeedsCare: boolean;
};

/** 주문 상태 → 화면 라벨 */
const STATUS_LABEL: Record<string, string> = {
  rejected: "반려됨",
  failed: "생성 오류",
  paid: "결제됨",
  generating: "생성 중",
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
  onRefund: (orderId: string, paymentLabel: string, needsCare: boolean) => void;
}) {
  return (
    <>
      <h2 style={S.section}>미완료 주문</h2>
      <p style={S.sub}>반려됨·생성 오류·결제됨·생성 중 {orders.length}건 · 조회 및 환불</p>
      {!loading && orders.length === 0 ? (
        <div style={S.empty}>미완료 주문이 없습니다.</div>
      ) : (
        !loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요금제</th>
                <th style={S.th}>상태</th>
                <th style={S.th}>결제</th>
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
                      {STATUS_LABEL[ord.status] ?? ord.status}
                    </span>
                  </td>
                  <td style={S.td}>
                    {/* 실제 출금 가능성이 있는 결제만 강조 — 테스트 결제와 구분 */}
                    <span style={ord.paymentNeedsCare ? S.statusRej : S.chipB}>
                      {ord.paymentLabel}
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
                      onClick={() => onRefund(ord.id, ord.paymentLabel, ord.paymentNeedsCare)}
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
