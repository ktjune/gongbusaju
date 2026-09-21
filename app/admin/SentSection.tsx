"use client";

import { S } from "./styles";

export type SentOrderItem = {
  id: string;
  tier: string;
  status: string; // "published" | "refunded"
  createdAt: string;
  buyerName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  resultUrl: string | null;
  notifyError: string | null;
  notifyDeliveredAt: string | null;
  refundedAt: string | null;
  hasPayment: boolean;
  paymentLabel: string;
  paymentNeedsCare: boolean;
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
  onRefund: (orderId: string, paymentLabel: string, needsCare: boolean) => void;
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
                        {o.buyerName && (
                          <div style={{ fontWeight: 600, color: "#1f3b63" }}>{o.buyerName}</div>
                        )}
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
                      ) : (
                        <DeliveryStatus
                          notifyError={o.notifyError}
                          notifyDeliveredAt={o.notifyDeliveredAt}
                        />
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
                          {o.refundedAt
                            ? `${new Date(o.refundedAt).toLocaleDateString("ko-KR")} (${o.paymentLabel})`
                            : "완료"}
                        </span>
                      ) : (
                        <button
                          style={S.reject}
                          disabled={busy === o.id}
                          onClick={() => onRefund(o.id, o.paymentLabel, o.paymentNeedsCare)}
                          title={
                            o.paymentNeedsCare
                              ? "실제 출금이 있었을 수 있습니다 — PG 결제취소가 실행됩니다"
                              : "실제 출금이 없는 결제입니다 — 상태만 전이됩니다"
                          }
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

/**
 * 발송 상태 — "보냈다"와 "닿았다"를 구분해서 보여준다.
 *
 * 2026-09-16 주문은 우리 기록에 "발송 완료"였지만 고객은 아무것도 못 받았다.
 * 접수(우리가 보낸 것)와 수신(발송사가 확인해 준 것)은 다른 사실이라 따로 적는다.
 *
 *   수신 확인   발송사 웹훅이 고객에게 닿았다고 확인 — 유일하게 믿을 수 있는 상태
 *   문자로 대체  원래 통로가 실패해 자동으로 문자를 다시 보냄 (사람이 할 일 없음)
 *   발송 실패   사람이 손대야 함
 *   확인 대기   보내긴 했으나 아직 결과가 오지 않음
 */
function DeliveryStatus({
  notifyError,
  notifyDeliveredAt,
}: {
  notifyError: string | null;
  notifyDeliveredAt: string | null;
}) {
  if (notifyDeliveredAt) {
    return (
      <span style={S.statusPub} title={new Date(notifyDeliveredAt).toLocaleString("ko-KR")}>
        수신 확인
      </span>
    );
  }
  if (notifyError?.startsWith("[자동복구]")) {
    return (
      <span style={S.statusPub} title={notifyError}>
        문자로 대체
      </span>
    );
  }
  if (notifyError) {
    return (
      <span style={S.statusFail} title={notifyError}>
        발송 실패
      </span>
    );
  }
  return (
    <span style={{ color: "#9a9fa8" }} title="보냈지만 아직 수신 확인이 오지 않았습니다">
      확인 대기
    </span>
  );
}
