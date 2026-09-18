/**
 * POST /api/admin/notify-test — 운영자 알림 메일이 실제로 가는지 확인한다
 *
 * 왜 필요한가: 2026-09-16 주문에서 어드민에는 매출이 잡혔는데 "새 주문" 메일이
 * 오지 않았다. sendOwnerAlert는 실패를 삼키고 콘솔에만 남겼고, Vercel 런타임 로그는
 * 몇 시간 뒤 사라져 사후에는 원인을 알 수 없었다. 주문을 기다리지 않고 지금 눌러
 * **같은 경로로** 메일을 보내 보고, 실패하면 그 이유를 화면에서 바로 읽게 한다.
 *
 * 비용: 메일 1통. 수신자는 NOTIFY_OWNER_EMAIL(사장님)뿐이라 고객에게는 가지 않는다.
 * 인증: middleware.ts — admin 세션
 */

import { sendOwnerAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  const startedAt = Date.now();
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const result = await sendOwnerAlert(
    "알림 메일 테스트",
    `어드민에서 보낸 테스트입니다. 이 메일이 도착했다면 새 주문 알림도 같은 경로로 도착합니다.\n보낸 시각: ${now}`
  );
  return Response.json({ ...result, ms: Date.now() - startedAt });
}
