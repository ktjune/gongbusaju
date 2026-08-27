"use client";

/**
 * /refund — 고객 환불 요청 접수
 *
 * 비회원 주문이 가능하므로 로그인으로 본인을 확인할 수 없다.
 * 주문번호 + 신청 시 입력한 연락처로 확인하고 요청만 접수한다.
 * 실제 환불은 운영자가 검토 후 실행한다(약관 §7).
 */

import { useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/support";
import Link from "next/link";
import styles from "../apply/apply.module.css";

type State =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "done"; orderId: string };

export default function RefundPage() {
  const [state, setState] = useState<State>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");

  async function submit() {
    setError(null);

    if (!orderId.trim() || !contact.trim()) {
      setError("주문번호와 연락처를 모두 입력해 주세요.");
      return;
    }
    if (!reason.trim()) {
      setError("환불 사유를 입력해 주세요.");
      return;
    }

    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), contact: contact.trim(), reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "환불 요청 접수에 실패했습니다.");
        setState({ kind: "form" });
        return;
      }
      setState({ kind: "done", orderId: data.orderId });
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setState({ kind: "form" });
    }
  }

  if (state.kind === "done") {
    return (
      <div className={styles.page}>
        <div className={styles.sheet}>
          <div className={styles.done}>
            <div className={styles.doneIcon}>✓</div>
            <h1 className={styles.title}>환불 요청이 접수되었습니다</h1>
            <p className={styles.subtitle}>주문번호 {state.orderId}</p>
            <p className={styles.hint}>
              담당자가 확인 후 처리해 드립니다. 처리 결과는 신청 시 입력하신
              연락처로 안내드립니다.
              <br />
              문의: 0502-1944-3249 · {SUPPORT_EMAIL}
            </p>
            <Link href="/" className={styles.submit} style={{ display: "block", marginTop: 24 }}>
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sending = state.kind === "sending";

  return (
    <div className={styles.page}>
      <div className={styles.sheet}>
        <div className={styles.badge}>고객 지원</div>
        <h1 className={styles.title}>환불 요청</h1>
        <p className={styles.subtitle}>
          주문번호와 신청 시 입력하신 연락처로 본인 확인 후 접수됩니다
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.notice}>
          <b>환불 안내 (이용약관 제7조)</b>
          <br />
          리포트 <b>제작 착수 전</b>이거나, 회사 귀책으로 리포트가 제공되지 못한
          경우 <b>전액 환불</b>해 드립니다. 개별 제작되는 디지털 콘텐츠 특성상
          제작이 시작된 이후의 단순 변심 환불은 어려울 수 있으며, 이 경우 담당자가
          개별적으로 안내드립니다.
        </div>

        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="orderId">
              주문번호
            </label>
            <input
              id="orderId"
              className={styles.input}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="신청 완료 화면 또는 안내 메일에 표시된 주문번호"
              disabled={sending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="contact">
              연락처 (이메일 또는 휴대폰)
            </label>
            <input
              id="contact"
              className={styles.input}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="신청 시 입력하신 이메일 또는 휴대폰 번호"
              disabled={sending}
            />
            <p className={styles.hint}>
              리포트를 받기로 하신 연락처와 같아야 본인 확인이 됩니다.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="reason">
              환불 사유
            </label>
            <input
              id="reason"
              className={styles.input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 잘못된 생년월일로 신청했습니다"
              disabled={sending}
            />
          </div>
        </div>

        <button className={styles.submit} onClick={submit} disabled={sending}>
          {sending ? "접수 중…" : "환불 요청하기"}
        </button>

        <p className={styles.hint} style={{ marginTop: 16, textAlign: "center" }}>
          주문번호를 모르시면 <b>0502-1944-3249</b> 또는{" "}
          <b>{SUPPORT_EMAIL}</b> 으로 연락 주세요.
        </p>
      </div>
    </div>
  );
}
