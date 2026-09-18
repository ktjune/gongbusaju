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
import { SentSection, type SentOrderItem } from "./SentSection";
import { CostsSection, type CostsData, type LlmHealth } from "./CostsSection";
import { RevenueSection, type RevenueData } from "./RevenueSection";
import { RefundRequestSection, type RefundRequestItem } from "./RefundRequestSection";

export default function AdminPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [regenOrders, setRegenOrders] = useState<RegenOrderItem[]>([]);
  const [notifyFailures, setNotifyFailures] = useState<NotifyFailureItem[]>([]);
  const [sentOrders, setSentOrders] = useState<SentOrderItem[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequestItem[]>([]);
  const [costs, setCosts] = useState<CostsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [health, setHealth] = useState<LlmHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  /**
   * 각 요청이 **도착하는 대로** 해당 영역을 그린다.
   *
   * 예전에는 8개를 Promise.all로 묶어 한꺼번에 기다렸다. 그래서 검수 큐처럼
   * 0.2초면 오는 목록도, LLM 생존 확인(모델 2개를 실제로 찔러 본다)이나
   * 솔라피 잔액 조회가 끝날 때까지 화면 전체가 멈춰 있었다 — "어드민이 버벅인다".
   *
   * loading은 **일 처리에 필요한 목록**에만 건다. 비용·매출·LLM 상태는 참고 정보라
   * 늦게 채워져도 일하는 데 지장이 없다.
   */
  const load = useCallback(async () => {
    setLoading(true);

    const get = (path: string) =>
      fetch(path)
        .then((r) => r.json())
        .catch(() => null);

    // 큐 목록 — 이것들이 오면 화면을 쓸 수 있다
    const queues = Promise.all([
      get("/api/admin/reports").then((d) => setItems(d?.items ?? [])),
      get("/api/admin/orders").then((d) => setRegenOrders(d?.items ?? [])),
      get("/api/admin/notify-failures").then((d) => setNotifyFailures(d?.items ?? [])),
      get("/api/admin/sent").then((d) => setSentOrders(d?.items ?? [])),
      get("/api/admin/refund-requests").then((d) => setRefundRequests(d?.items ?? [])),
    ]);

    // 참고 정보 — 화면을 막지 않고 뒤따라 채운다
    void get("/api/admin/revenue").then((d) => setRevenue(d && d.total ? d : null));
    void get("/api/admin/costs").then((d) => setCosts(d && d.month ? d : null));
    void get("/api/admin/llm-health").then((d) =>
      setHealth(d && Array.isArray(d.providers) ? d : null)
    );

    try {
      await queues;
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

  async function refund(orderId: string, paymentLabel: string, needsCare: boolean) {
    // 결제 성격을 명시한다. PG 테스트 결제도 취소 API가 성공하고 PG사가
    // "결제가 취소되었어요" 안내 메일을 자동 발송하므로, 그 메일만으로는
    // 실제 환불된 돈이 있는지 구분할 수 없다.
    const reason = window.prompt(
      needsCare
        ? `[${paymentLabel}] 실제 출금이 있었을 수 있습니다. PG 결제취소가 실행됩니다.\n환불 사유를 입력하세요:`
        : `[${paymentLabel}] 실제 출금이 없는 결제입니다. 상태 전이만 이뤄집니다.\n환불 사유를 입력하세요:`
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

        <RevenueSection revenue={revenue} loading={loading} />
        <CostsSection costs={costs} health={health} loading={loading} />

        {/* 고객이 직접 접수한 환불 요청 — 가장 먼저 눈에 띄어야 한다 */}
        <RefundRequestSection
          items={refundRequests}
          loading={loading}
          busy={busy}
          onRefund={refund}
        />

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

        <SentSection
          orders={sentOrders}
          loading={loading}
          busy={busy}
          onRefund={refund}
          onRegenerate={regenerate}
        />
      </div>
    </div>
  );
}
