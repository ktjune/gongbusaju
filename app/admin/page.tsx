"use client";

/**
 * /admin — 검수 큐
 *
 * 검수 대기(pending) 리포트 목록 → 미리보기 → 승인/반려.
 * 승인 시 결과페이지 공개(published), 반려 시 재생성 대상(rejected).
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 */

import { useEffect, useState, useCallback } from "react";

type Item = {
  id: string;
  orderId: string;
  token: string;
  tier: string;
  reviewStatus: string;
  createdAt: string;
};

type OrderItem = {
  id: string;
  tier: string;
  status: string;
  createdAt: string;
};

export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [regenOrders, setRegenOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, ord] = await Promise.all([
        fetch("/api/admin/reports").then((r) => r.json()),
        fetch("/api/admin/orders").then((r) => r.json()),
      ]);
      setItems(rep.items ?? []);
      setRegenOrders(ord.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerate(orderId: string) {
    setBusy(orderId);
    setMsg(null);
    try {
      const res = await fetch("/api/generate-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`오류: ${data.error}`);
      } else {
        setMsg(`재생성 완료 — 검수 대기로 이동됨`);
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function review(reportId: string, action: "approve" | "reject") {
    let note = "";
    if (action === "reject") {
      note = window.prompt("반려 사유를 입력하세요:") ?? "";
      if (note === "") return; // 취소
    }
    setBusy(reportId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`오류: ${data.error}`);
      } else {
        setMsg(`처리 완료: ${action === "approve" ? "승인(발행)" : "반려"}`);
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.sheet}>
        <h1 style={S.title}>검수 큐</h1>
        <p style={S.sub}>
          검수 대기 {items.length}건
        </p>
        {msg && <div style={S.msg}>{msg}</div>}

        {loading ? (
          <p style={S.sub}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <div style={S.empty}>검수 대기 중인 리포트가 없습니다.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요금제</th>
                <th style={S.th}>접수</th>
                <th style={S.th}>미리보기</th>
                <th style={S.th}>검수</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={S.td}>
                    <span style={it.tier === "premium" ? S.chipP : S.chipB}>
                      {it.tier}
                    </span>
                  </td>
                  <td style={S.td}>
                    {new Date(it.createdAt).toLocaleString("ko-KR")}
                  </td>
                  <td style={S.td}>
                    <a
                      style={S.link}
                      href={`/result/${it.token}?preview=1`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      열기 ↗
                    </a>
                  </td>
                  <td style={S.td}>
                    <button
                      style={S.approve}
                      disabled={busy === it.id}
                      onClick={() => review(it.id, "approve")}
                    >
                      승인
                    </button>
                    <button
                      style={S.reject}
                      disabled={busy === it.id}
                      onClick={() => review(it.id, "reject")}
                    >
                      반려
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 style={S.section}>재생성 대기</h2>
        <p style={S.sub}>반려됨·생성 오류 {regenOrders.length}건</p>
        {!loading && regenOrders.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {regenOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td style={S.td}>
                      <span style={ord.tier === "premium" ? S.chipP : S.chipB}>
                        {ord.tier}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={ord.status === "rejected" ? S.statusRej : S.statusFail}>
                        {ord.status === "rejected" ? "반려됨" : "생성 오류"}
                      </span>
                    </td>
                    <td style={S.td}>
                      {new Date(ord.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td style={S.td}>
                      <button
                        style={S.approve}
                        disabled={busy === ord.id}
                        onClick={() => regenerate(ord.id)}
                      >
                        {busy === ord.id ? "처리 중…" : "재생성"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#faf7f1",
    color: "#2c2c30",
    fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    padding: "40px 20px",
  },
  sheet: { maxWidth: 820, margin: "0 auto" },
  title: { color: "#1f3b63", fontSize: "1.6rem", margin: "0 0 6px" },
  sub: { color: "#5a5f6a", fontSize: "0.9rem", margin: "0 0 20px" },
  msg: {
    background: "#eef4ff",
    border: "1px solid #c5d6f0",
    color: "#1f3b63",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 16,
    fontSize: "0.9rem",
  },
  empty: {
    background: "#fff",
    border: "1px solid #e3ddd1",
    borderRadius: 12,
    padding: "40px",
    textAlign: "center",
    color: "#5a5f6a",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(31,59,99,0.06)",
  },
  th: {
    textAlign: "left",
    padding: "12px 14px",
    background: "#efe9dd",
    color: "#1f3b63",
    fontSize: "0.85rem",
  },
  td: {
    padding: "12px 14px",
    borderTop: "1px solid #e3ddd1",
    fontSize: "0.9rem",
  },
  chipB: {
    background: "#eef0f3",
    color: "#34507a",
    borderRadius: 12,
    padding: "2px 10px",
    fontSize: "0.8rem",
  },
  chipP: {
    background: "#1f3b63",
    color: "#fff",
    borderRadius: 12,
    padding: "2px 10px",
    fontSize: "0.8rem",
  },
  link: { color: "#3b6fb5", textDecoration: "none", fontWeight: 600 },
  approve: {
    background: "#1f3b63",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    marginRight: 6,
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  reject: {
    background: "#fff",
    color: "#a33",
    border: "1px solid #e0b4b0",
    borderRadius: 8,
    padding: "7px 14px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  section: {
    color: "#1f3b63",
    fontSize: "1.2rem",
    margin: "36px 0 6px",
  },
  statusRej: {
    background: "#fdf0ee",
    color: "#a33",
    borderRadius: 12,
    padding: "2px 10px",
    fontSize: "0.8rem",
  },
  statusFail: {
    background: "#fff8ec",
    color: "#9a6200",
    borderRadius: 12,
    padding: "2px 10px",
    fontSize: "0.8rem",
  },
};
