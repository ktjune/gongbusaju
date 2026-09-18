"use client";

import { useState } from "react";
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
      <OwnerAlertTest />
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

/**
 * 운영자 알림 메일 점검.
 *
 * "매출은 잡혔는데 새 주문 메일이 안 왔다"(2026-09-16)를 주문이 들어오기를
 * 기다리지 않고 지금 확인한다. 새 주문 알림과 **같은 경로**로 한 통을 보내고,
 * 실패하면 이유를 그대로 보여준다.
 */
function OwnerAlertTest() {
  const [state, setState] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({
    busy: false,
    msg: null,
    ok: false,
  });

  async function run() {
    setState({ busy: true, msg: null, ok: false });
    try {
      const res = await fetch("/api/admin/notify-test", { method: "POST" });
      const data = (await res.json()) as { sent?: boolean; error?: string; ms?: number };
      setState({
        busy: false,
        ok: !!data.sent,
        msg: data.sent
          ? `발송 성공 (${data.ms}ms) — 메일함을 확인해 주세요. 안 보이면 스팸함도 확인해 주세요.`
          : `발송 실패 — ${data.error ?? "알 수 없는 오류"}`,
      });
    } catch (e) {
      setState({
        busy: false,
        ok: false,
        msg: `요청 실패 — ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return (
    <div style={{ margin: "0 0 14px" }}>
      <button style={S.approve} disabled={state.busy} onClick={run}>
        {state.busy ? "보내는 중…" : "알림 메일 테스트 발송"}
      </button>
      {state.msg && (
        <span style={{ marginLeft: 10, fontSize: "0.85rem", color: state.ok ? "#2b6a3f" : "#a33" }}>
          {state.msg}
        </span>
      )}
    </div>
  );
}
