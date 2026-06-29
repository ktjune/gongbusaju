"use client";

import { S } from "./styles";

export type ReviewItem = {
  id: string;
  orderId: string;
  token: string;
  tier: string;
  reviewStatus: string;
  createdAt: string;
};

export function ReviewQueueSection({
  items,
  loading,
  busy,
  onReview,
}: {
  items: ReviewItem[];
  loading: boolean;
  busy: string | null;
  onReview: (reportId: string, action: "approve" | "reject") => void;
}) {
  return (
    <>
      <h1 style={S.title}>검수 큐</h1>
      <p style={S.sub}>검수 대기 {items.length}건</p>

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
                  <span style={it.tier === "premium" ? S.chipP : S.chipB}>{it.tier}</span>
                </td>
                <td style={S.td}>{new Date(it.createdAt).toLocaleString("ko-KR")}</td>
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
                    onClick={() => onReview(it.id, "approve")}
                  >
                    승인
                  </button>
                  <button
                    style={S.reject}
                    disabled={busy === it.id}
                    onClick={() => onReview(it.id, "reject")}
                  >
                    반려
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
