"use client";

import { S } from "./styles";

/**
 * 매출 — 건수·금액·유입 채널.
 *
 * 여기 숫자는 DB의 실제 결제 기록이다. GA4와 다를 수 있고, 다르면 이쪽이 맞다
 * (GA4는 확정에 24~48시간이 걸리고 환불을 반영하지 않는다).
 */

export type RevenueData = {
  total: {
    count: number;
    grossKrw: number;
    refundedCount: number;
    refundedKrw: number;
    netKrw: number;
  };
  byChannel: { name: string; count: number; krw: number; refunded: number }[];
  byLanding: { name: string; count: number; krw: number }[];
  byDay: { date: string; count: number; krw: number }[];
};

const krw = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const card: React.CSSProperties = {
  flex: "1 1 150px",
  background: "#fff",
  border: "1px solid #e3ddd1",
  borderRadius: 12,
  padding: "14px 16px",
};
const cardLabel: React.CSSProperties = { fontSize: "0.78rem", color: "#5a5f6a", marginBottom: 4 };
const cardValue: React.CSSProperties = { fontSize: "1.25rem", fontWeight: 700, color: "#1f3b63" };
const cardSub: React.CSSProperties = { fontSize: "0.74rem", color: "#9a9fa8", marginTop: 4, lineHeight: 1.5 };

export function RevenueSection({
  revenue,
  loading,
}: {
  revenue: RevenueData | null;
  loading: boolean;
}) {
  if (loading || !revenue) {
    return (
      <>
        <h2 style={S.section}>매출</h2>
        <div style={S.empty}>불러오는 중…</div>
      </>
    );
  }

  const { total, byChannel, byLanding, byDay } = revenue;

  return (
    <>
      <h2 style={S.section}>매출</h2>
      <p style={S.sub}>
        실제 결제 기록 기준입니다. 모의 결제는 빠지고, 환불된 건은 매출에서 뺍니다 —
        GA4와 숫자가 다르면 이쪽이 맞습니다.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={card}>
          <div style={cardLabel}>실매출 (환불 제외)</div>
          <div style={cardValue}>{krw(total.netKrw)}</div>
          <div style={cardSub}>{total.count - total.refundedCount}건</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>총 결제</div>
          <div style={cardValue}>{krw(total.grossKrw)}</div>
          <div style={cardSub}>{total.count}건</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>환불</div>
          <div style={{ ...cardValue, color: total.refundedCount ? "#b4453c" : "#1f3b63" }}>
            {krw(total.refundedKrw)}
          </div>
          <div style={cardSub}>{total.refundedCount}건</div>
        </div>
      </div>

      <h3 style={{ ...S.section, fontSize: "1rem", marginTop: 24 }}>유입 채널별</h3>
      <p style={S.sub}>
        결제 시점에 기록된 값입니다. &ldquo;미상&rdquo;은 직접 방문이거나 유입 경로를 남기기 전에
        들어온 주문입니다.
      </p>
      {byChannel.length === 0 ? (
        <div style={S.empty}>아직 집계할 결제가 없습니다.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>채널</th>
              <th style={S.th}>건수</th>
              <th style={S.th}>매출</th>
              <th style={S.th}>환불</th>
            </tr>
          </thead>
          <tbody>
            {byChannel.map((c) => (
              <tr key={c.name}>
                <td style={S.td}>{c.name}</td>
                <td style={S.td}>{c.count}</td>
                <td style={S.td}>{krw(c.krw)}</td>
                <td style={S.td}>{c.refunded || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ ...S.section, fontSize: "1rem", marginTop: 24 }}>진입 경로별</h3>
      <p style={S.sub}>광고 전용 랜딩(/case)이 실제로 파는지 봅니다.</p>
      {byLanding.length === 0 ? (
        <div style={S.empty}>아직 집계할 결제가 없습니다.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>첫 진입 경로</th>
              <th style={S.th}>건수</th>
              <th style={S.th}>매출</th>
            </tr>
          </thead>
          <tbody>
            {byLanding.map((l) => (
              <tr key={l.name}>
                <td style={S.td}>{l.name}</td>
                <td style={S.td}>{l.count}</td>
                <td style={S.td}>{krw(l.krw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ ...S.section, fontSize: "1rem", marginTop: 24 }}>최근 결제일 (KST)</h3>
      {byDay.length === 0 ? (
        <div style={S.empty}>아직 집계할 결제가 없습니다.</div>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>날짜</th>
              <th style={S.th}>건수</th>
              <th style={S.th}>매출</th>
            </tr>
          </thead>
          <tbody>
            {byDay.map((d) => (
              <tr key={d.date}>
                <td style={S.td}>{d.date}</td>
                <td style={S.td}>{d.count}</td>
                <td style={S.td}>{krw(d.krw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
