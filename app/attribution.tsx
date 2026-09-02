"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/**
 * 첫 진입 시 유입 경로를 sessionStorage에 담아두는 클라이언트 훅.
 *
 * 루트 레이아웃에 한 번 올려둔다 — 광고 링크(`/case?utm_...`)로 들어온 뒤
 * `/apply`로 이동해 결제하므로, 진입 시점에 잡아두지 않으면 주문 시점엔 이미 사라진다.
 *
 * 렌더하는 것이 없다. 실패해도 조용히 넘어간다(lib/attribution 참고).
 */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
