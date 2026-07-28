/**
 * GET /api/admin/costs — 이번 달 운영 비용 현황 (어드민 "비용" 섹션)
 *
 * - 솔라피: 잔액은 API 실측. 알림톡 지출은 발송 건수(우리 DB) × 건당 단가 추정.
 * - AI(Gemini): 구글이 지출 조회 API를 제공하지 않아, 생성 실행 횟수
 *   (orders.generateAttempts 합 — 재시도 포함 실측) × 회당 토큰 추정 × 단가로 추정.
 *   실측 프롬프트 크기: 입력 ~1.5만 토큰/회, 출력 ~2만 토큰/회.
 *
 * 단가는 env로 오버라이드 가능 (가격 개정 대응):
 *   ALIMTALK_KRW_PER_MSG (기본 13원) · GEMINI_USD_PER_MTOK_IN (기본 0.30)
 *   GEMINI_USD_PER_MTOK_OUT (기본 2.50) · USD_KRW (기본 1450)
 *
 * 인증: middleware.ts — admin 세션
 */

import { getOrderStore } from "@/lib/orders";
import { getSolapiBalance } from "@/lib/notify";

export const runtime = "nodejs";

const num = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/** 생성 1회당 토큰 추정 (실측 기반: 입력 ~14.3K자, 산문 출력 ~15-17K자) */
const TOKENS_IN_PER_RUN = 15_000;
const TOKENS_OUT_PER_RUN = 20_000;

export async function GET() {
  const alimtalkKrw = num(process.env.ALIMTALK_KRW_PER_MSG, 13);
  const usdPerMtokIn = num(process.env.GEMINI_USD_PER_MTOK_IN, 0.3);
  const usdPerMtokOut = num(process.env.GEMINI_USD_PER_MTOK_OUT, 2.5);
  const usdKrw = num(process.env.USD_KRW, 1450);

  const store = getOrderStore();
  const [orders, solapi] = await Promise.all([
    store.listOrders(),
    getSolapiBalance(),
  ]);

  const ym = new Date().toISOString().slice(0, 7); // "2026-07"
  const monthOrders = orders.filter((o) => o.createdAt.startsWith(ym));

  // 알림톡: 이번 달 발행 완료 + 전화번호 있는 주문 = 발송 시도 건수
  const alimtalkCount = monthOrders.filter(
    (o) => (o.status === "published" || o.status === "refunded") && o.contactPhone
  ).length;

  // AI: 이번 달 주문의 생성 실행 횟수 합 (재시도 포함 — generateAttempts는 실측 카운트)
  const aiRuns = monthOrders.reduce((a, o) => a + o.generateAttempts, 0);
  const tokensIn = aiRuns * TOKENS_IN_PER_RUN;
  const tokensOut = aiRuns * TOKENS_OUT_PER_RUN;
  const aiUsd = (tokensIn / 1e6) * usdPerMtokIn + (tokensOut / 1e6) * usdPerMtokOut;

  return Response.json({
    month: ym,
    solapi: solapi
      ? { balance: solapi.balance, point: solapi.point }
      : null, // 키 미설정·API 실패
    alimtalk: {
      count: alimtalkCount,
      estKrw: Math.round(alimtalkCount * alimtalkKrw),
      unitKrw: alimtalkKrw,
    },
    ai: {
      runs: aiRuns,
      estTokensIn: tokensIn,
      estTokensOut: tokensOut,
      estKrw: Math.round(aiUsd * usdKrw),
    },
    orders: { month: monthOrders.length, published: monthOrders.filter((o) => o.status === "published").length },
    links: {
      solapi: "https://console.solapi.com",
      gemini: "https://aistudio.google.com/usage",
      anthropic: "https://console.anthropic.com/settings/usage",
    },
  });
}
