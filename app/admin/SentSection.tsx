"use client";

import { S } from "./styles";

export type SentOrderItem = {
  id: string;
  tier: string;
  status: string; // "published" | "refunded"
  createdAt: string;
  contactEmail: string | null;
  contactPhone: string | null;
  resultUrl: string | null;
  notifyError: string | null;
  refundedAt: string | null;
  hasPayment: boolean;
};

export function SentSection({
  orders,
  loading,
  busy,
  onRefund,
  onRegenerate,
}: {
  orders: SentOrderItem[];
  loading: boolean;
  busy: string | null;
  onRefund: (orderId: string, hasPayment: boolean) => void;
  onRegenerate: (orderId: string) => void;
}) {
  return (
    <>
      <h2 style={S.section}>발송 완료</h2>
      <p style={S.sub}>발송된 리포트 {orders.length}건 · 연락처·내용 확인 및 환불</p>
      {!loading && orders.length === 0 ? (
        <div style={S.empty}>발송된 리포트가 없습니다.</div>
      ) : (
        !loading && (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>접수일</th>
                <th style={S.th}>연락처</th>
                <th style={S.th}>리포트</th>
                <th style={S.th}>상태</th>
                <th style={S.th}>재생성</th>
                <th style={S.th}>환불</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const refunded = o.status === "refunded";
                return (
                  <tr key={o.id}>
                    <td style={S.td}>{new Date(o.createdAt).toLocaleString("ko-KR")}</td>
                    <td style={S.td}>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                        {o.contactEmail && <div>✉ {o.contactEmail}</div>}
                        {o.contactPhone && <div>📱 {o.contactPhone}</div>}
                        {!o.contactEmail && !o.contactPhone && (
                          <span style={{ color: "#9a9fa8" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>
                      {o.resultUrl ? (
                        <a
                          href={o.resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#2a5a9a", fontWeight: 600, textDecoration: "underline" }}
                        >
                          리포트 열기 ↗
                        </a>
                      ) : (
                        <span style={{ color: "#9a9fa8" }}>—</span>
                      )}
                    </td>
                    <td style={S.td}>
                      {refunded ? (
                        <span style={S.statusRej}>환불됨</span>
                      ) : o.notifyError ? (
                        <span style={S.statusFail}>발송 실패</span>
                      ) : (
                        <span style={S.statusPub}>발송 완료</span>
                      )}
                    </td>
                    <td style={S.td}>
                      {refunded ? (
                        <span style={{ color: "#9a9fa8" }}>—</span>
                      ) : (
                        <button
                          style={S.approve}
                          disabled={busy === o.id}
                          onClick={() => onRegenerate(o.id)}
                          title="개선된 내용으로 다시 생성해 재발송합니다 (새 링크)"
                        >
                          {busy === o.id ? "처리 중…" : "재생성"}
                        </button>
                      )}
                    </td>
                    <td style={S.td}>
                      {refunded ? (
                        <span style={{ color: "#9a9fa8", fontSize: 12 }}>
                          {o.refundedAt ? new Date(o.refundedAt).toLocaleDateString("ko-KR") : "완료"}
                        </span>
                      ) : (
                        <button
                          style={S.reject}
                          disabled={busy === o.id}
                          onClick={() => onRefund(o.id, o.hasPayment)}
                        >
                          {busy === o.id ? "처리 중…" : "환불"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </>
  );
}
