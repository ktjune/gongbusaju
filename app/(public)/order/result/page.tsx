"use client";

/**
 * /order/result — 포트원 결제 완료 처리
 *
 * 모바일은 결제 앱에서 redirectUrl로 돌아오고(?paymentId=&code=&message=),
 * PC 팝업은 apply 페이지가 ?paymentId= 를 붙여 이리로 보낸다 — 둘 다 같은 경로.
 *
 * 성공: ?paymentId= → sessionStorage의 신청 데이터와 함께 /api/order 로 전송
 *       → 서버가 PG에 결제 내역을 조회·검증한 뒤 주문 생성.
 * 실패: ?code=&message= → 실패 안내.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../../apply/apply.module.css";
import { trackPurchase } from "@/lib/analytics";
import { REPORT_PRICE } from "@/lib/pricing";

const ORDER_PAYLOAD_KEY = "gbsj_order_payload";

type State =
  | { kind: "loading" }
  | { kind: "success"; orderId: string }
  | { kind: "fail"; message: string }
  | { kind: "error"; message: string };

function OrderResult() {
  const params = useSearchParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const paymentId = params.get("paymentId");
    const failCode = params.get("code");
    const failMessage = params.get("message");

    // 결제 실패/취소 — 포트원은 실패 시 code·message를 붙여 돌려보낸다
    if (!paymentId || failCode) {
      setState({
        kind: "fail",
        message: failMessage ?? "결제가 취소되었거나 완료되지 않았습니다.",
      });
      return;
    }

    // 결제 성공 → 신청 데이터 복원 후 주문 생성
    const raw = sessionStorage.getItem(ORDER_PAYLOAD_KEY);
    if (!raw) {
      setState({
        kind: "error",
        message:
          "신청 정보를 찾을 수 없습니다. 결제가 완료되었다면 문의처로 연락해 주세요. (중복 처리 방지를 위해 새로고침 시 나타날 수 있습니다)",
      });
      return;
    }

    (async () => {
      try {
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, paymentId }),
        });
        const data = await res.json();
        sessionStorage.removeItem(ORDER_PAYLOAD_KEY);
        if (!res.ok) {
          setState({ kind: "error", message: data.error ?? "주문 생성에 실패했습니다." });
          return;
        }
        // 주문이 실제로 만들어진 뒤에만 결제완료를 기록한다.
        // 결제창을 띄운 시점에 기록하면 이탈한 사람까지 매출로 잡힌다.
        trackPurchase(data.orderId, REPORT_PRICE);
        setState({ kind: "success", orderId: data.orderId });
      } catch {
        setState({
          kind: "error",
          message: "처리 중 오류가 발생했습니다. 결제가 완료되었다면 문의처로 연락해 주세요.",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === "loading") {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>⏳</div>
        <h1 className={styles.title}>결제 확인 중…</h1>
        <p className={styles.subtitle}>잠시만 기다려 주세요. 결제를 검증하고 신청을 접수하고 있습니다.</p>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>✓</div>
        <h1 className={styles.title}>결제·신청이 완료되었습니다</h1>
        <p className={styles.subtitle}>
          리포트는 사주 계산과 검수를 거쳐 제작됩니다.
          <br />
          완성되면 입력하신 연락처로 결과 링크를 보내 드립니다.
        </p>
        <p className={styles.hint}>접수번호: {state.orderId}</p>
        <Link href="/" className={styles.notice} style={{ textDecoration: "underline" }}>
          홈으로
        </Link>
      </div>
    );
  }

  // fail | error
  return (
    <div className={styles.done}>
      <div className={styles.doneIcon}>⚠️</div>
      <h1 className={styles.title}>
        {state.kind === "fail" ? "결제가 완료되지 않았습니다" : "처리 중 문제가 발생했습니다"}
      </h1>
      <p className={styles.subtitle}>{state.message}</p>
      <Link href="/apply" className={styles.notice} style={{ textDecoration: "underline" }}>
        다시 신청하기
      </Link>
    </div>
  );
}

export default function OrderResultPage() {
  return (
    <div className={styles.page}>
      <div className={styles.sheet}>
        <Suspense
          fallback={
            <div className={styles.done}>
              <div className={styles.doneIcon}>⏳</div>
              <h1 className={styles.title}>불러오는 중…</h1>
            </div>
          }
        >
          <OrderResult />
        </Suspense>
      </div>
    </div>
  );
}
