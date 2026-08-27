"use client";

import { S } from "./styles";

/** /api/admin/llm-health 응답 */
export type LlmHealth = {
  providers: { label: string; role: "primary" | "fallback"; ok: boolean; ms: number; error?: string }[];
  primaryOk?: boolean;
  hasFallback?: boolean;
  fallbackOk?: boolean;
  note?: string | null;
};

export type CostsData = {
  month: string;
  solapi: { balance: number; point: number } | null;
  alimtalk: { count: number; estKrw: number; unitKrw: number };
  ai: { runs: number; estTokensIn: number; estTokensOut: number; estKrw: number };
  orders: { month: number; published: number };
  links: { solapi: string; gemini: string; anthropic: string };
};

const krw = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const card: React.CSSProperties = {
  flex: "1 1 160px",
  background: "#fff",
  border: "1px solid #e3ddd1",
  borderRadius: 12,
  padding: "14px 16px",
};
const cardLabel: React.CSSProperties = { fontSize: "0.78rem", color: "#5a5f6a", marginBottom: 4 };
const cardValue: React.CSSProperties = { fontSize: "1.25rem", fontWeight: 700, color: "#1f3b63" };
const cardSub: React.CSSProperties = { fontSize: "0.74rem", color: "#9a9fa8", marginTop: 4, lineHeight: 1.5 };

export function CostsSection({
  costs,
  health,
  loading,
}: {
  costs: CostsData | null;
  health: LlmHealth | null;
  loading: boolean;
}) {
  return (
    <>
      <h2 style={S.section}>이번 달 비용 {costs ? `(${costs.month})` : ""}</h2>
      <p style={S.sub}>솔라피 잔액은 실측, 알림톡·AI는 발송/생성 건수 기반 추정입니다.</p>
      {loading || !costs ? (
        <div style={S.empty}>불러오는 중…</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={card}>
              <div style={cardLabel}>솔라피 잔액 (실측)</div>
              <div style={cardValue}>
                {costs.solapi ? krw(costs.solapi.balance) : "조회 불가"}
              </div>
              <div style={cardSub}>
                {costs.solapi
                  ? `포인트 ${costs.solapi.point.toLocaleString("ko-KR")}P · 잔액 부족 시 발송 중단`
                  : "API 키 미설정 또는 조회 실패"}
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>알림톡 지출 (추정)</div>
              <div style={cardValue}>{krw(costs.alimtalk.estKrw)}</div>
              <div style={cardSub}>
                발송 {costs.alimtalk.count}건 × {costs.alimtalk.unitKrw}원
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>AI 토큰 지출 (추정)</div>
              <div style={cardValue}>{krw(costs.ai.estKrw)}</div>
              <div style={cardSub}>
                생성 {costs.ai.runs}회 · 입력 ~{Math.round(costs.ai.estTokensIn / 1000)}K / 출력 ~
                {Math.round(costs.ai.estTokensOut / 1000)}K 토큰
              </div>
            </div>
            <div style={card}>
              <div style={cardLabel}>이번 달 주문</div>
              <div style={cardValue}>{costs.orders.month}건</div>
              <div style={cardSub}>발행 완료 {costs.orders.published}건</div>
            </div>
          </div>
          {/* LLM 생존 확인 — 폴백은 정작 필요한 순간에 처음 호출된다.
              평소에 상태를 보여주지 않으면 죽어 있어도 알 수 없다. */}
          <div style={{ marginTop: 14 }}>
            <div style={{ ...cardLabel, marginBottom: 6 }}>LLM 공급자 상태</div>
            {!health ? (
              <div style={{ fontSize: "0.8rem", color: "#9a9fa8" }}>확인 중…</div>
            ) : health.providers.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "#9a9fa8" }}>{health.note}</div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {health.providers.map((p) => (
                    <span
                      key={p.label}
                      title={p.error ?? ""}
                      style={{
                        fontSize: "0.78rem",
                        padding: "5px 10px",
                        borderRadius: 999,
                        border: `1px solid ${p.ok ? "#cfe3d0" : "#f0c9c9"}`,
                        background: p.ok ? "#f3faf3" : "#fdf3f3",
                        color: p.ok ? "#2f6b39" : "#a33",
                      }}
                    >
                      {p.ok ? "●" : "▲"} {p.label}
                      <span style={{ color: "#9a9fa8" }}>
                        {" "}
                        · {p.role === "primary" ? "주력" : "폴백"}
                        {p.ok ? ` · ${p.ms}ms` : " · 실패"}
                      </span>
                    </span>
                  ))}
                </div>
                {health.note && (
                  <div style={{ fontSize: "0.76rem", color: "#a33", marginTop: 6 }}>
                    {health.note}
                  </div>
                )}
              </>
            )}
          </div>
          <p style={{ fontSize: "0.78rem", color: "#9a9fa8", marginTop: 10 }}>
            정확한 청구액:{" "}
            <a href={costs.links.solapi} target="_blank" rel="noopener noreferrer" style={S.link}>
              솔라피 콘솔
            </a>
            {" · "}
            <a href={costs.links.gemini} target="_blank" rel="noopener noreferrer" style={S.link}>
              Google AI Studio 사용량
            </a>
            {" · "}
            <a href={costs.links.anthropic} target="_blank" rel="noopener noreferrer" style={S.link}>
              Anthropic 콘솔
            </a>
          </p>
        </>
      )}
    </>
  );
}
