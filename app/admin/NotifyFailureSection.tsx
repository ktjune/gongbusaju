"use client";

import { S } from "./styles";

export type NotifyFailureItem = {
  id: string;
  tier: string;
  notifyError: string | null;
  notifyFailedAt: string | null;
};

export function NotifyFailureSection({
  items,
  loading,
  busy,
  onRetry,
}: {
  items: NotifyFailureItem[];
  loading: boolean;
  busy: string | null;
  onRetry: (orderId: string) => void;
}) {
  return (
    <>
      <h2 style={S.section}>발송 실패</h2>
      <p style={S.sub}>결과 링크 발송에 실패한 주문 {items.length}건</p>
      {!loading && items.length === 0 ? (
        <div style={S.empty}>발송 실패 건이 없습니다.</div>
      ) : (
        !loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요금제</th>
                <th style={S.th}>실패 사유</th>
                <th style={S.th}>실패 시각</th>
                <th style={S.th}>재발송</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={S.td}>
                    <span style={it.tier === "premium" ? S.chipP : S.chipB}>{it.tier}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.errText}>{it.notifyError}</span>
                  </td>
                  <td style={S.td}>
                    {it.notifyFailedAt
                      ? new Date(it.notifyFailedAt).toLocaleString("ko-KR")
                      : "-"}
                  </td>
                  <td style={S.td}>
                    <button
                      style={S.approve}
                      disabled={busy === it.id}
                      onClick={() => onRetry(it.id)}
                    >
                      {busy === it.id ? "처리 중…" : "재발송"}
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
