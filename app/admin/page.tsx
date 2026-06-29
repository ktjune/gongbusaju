"use client";

/**
 * /admin — 검수 큐
 *
 * 검수 대기(pending) 리포트 목록 → 미리보기 → 승인/반려.
 * 승인 시 결과페이지 공개(published), 반려 시 재생성 대상(rejected).
 * 발송 실패한 주문은 별도 큐에서 재발송할 수 있다.
 *
 * 인증: middleware.ts — HTTP Basic Auth (ADMIN_PASSWORD env var)
 *
 * 데이터 fetch·상태는 이 파일에서 관리하고, 렌더는 섹션별 컴포넌트로 분리했다
 * (ReviewQueueSection / RegenQueueSection / NotifyFailureSection).
 */

import { useEffect, useState, useCallback } from "react";
import { S } from "./styles";
import { ReviewQueueSection, type ReviewItem } from "./ReviewQueueSection";
import { RegenQueueSection, type RegenOrderItem } from "./RegenQueueSection";
import { NotifyFailureSection, type NotifyFailureItem } from "./NotifyFailureSection";

export default function AdminPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [regenOrders, setRegenOrders] = useState<RegenOrderItem[]>([]);
  const [notifyFailures, setNotifyFailures] = useState<NotifyFailureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, ord, fail] = await Promise.all([
        fetch("/api/admin/reports").then((r) => r.json()),
        fetch("/api/admin/orders").then((r) => r.json()),
        fetch("/api/admin/notify-failures").then((r) => r.json()),
      ]);
      setItems(rep.items ?? []);
      setRegenOrders(ord.items ?? []);
      setNotifyFailures(fail.items ?? []);
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

  async function refund(orderId: string, hasPayment: boolean) {
    const reason = window.prompt(
      hasPayment
        ? "환불 사유를 입력하세요 (토스 결제취소가 실행됩니다):"
        : "환불 사유를 입력하세요 (모의 결제 — 토스 호출 없이 상태만 전이됩니다):"
    );
    if (reason === null) return; // 취소
    if (!window.confirm("정말 환불 처리하시겠습니까? 되돌릴 수 없습니다.")) return;

    setBusy(orderId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`오류: ${data.error}`);
      } else {
        setMsg(`환불 완료 — 주문 ${orderId}`);
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

  async function retryNotify(orderId: string) {
    setBusy(orderId);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/notify-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`오류: ${data.error}`);
      } else if (data.hasFailure) {
        setMsg(`재발송도 실패했습니다 — 주문 ${orderId}`);
        await load();
      } else {
        setMsg(`재발송 완료 — 주문 ${orderId}`);
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.sheet}>
        {msg && <div style={S.msg}>{msg}</div>}

        <ReviewQueueSection items={items} loading={loading} busy={busy} onReview={review} />

        <RegenQueueSection
          orders={regenOrders}
          loading={loading}
          busy={busy}
          onRegenerate={regenerate}
          onRefund={refund}
        />

        <NotifyFailureSection
          items={notifyFailures}
          loading={loading}
          busy={busy}
          onRetry={retryNotify}
        />
      </div>
    </div>
  );
}
