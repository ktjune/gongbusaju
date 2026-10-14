/**
 * GET /api/worker/notify-audit — 아침 운영 점검
 *
 * Vercel Cron이 하루 1회(08:50 KST 무렵) 호출한다 (vercel.json 참고). 두 가지를 한다:
 *
 * 1. 수신 미확인 감사 — 발송했는데 수신 확인이 없는 주문을 운영자에게 알린다.
 *    앞단(접수 검사·문자 폴백·발송 결과 웹훅)이 모두 놓친 건을 잡는 마지막 안전망.
 *    판정 기준은 lib/orders/notify-audit.
 * 2. 운영 요약 — 멈춘 주문·검수 대기·발송 실패·환불 요청·AI 공급자 상태를 모아
 *    손댈 것이 있을 때만 메일 한 통으로 알린다 (lib/orders/ops-digest).
 *    감사(1)가 먼저 돌아 이미 알린 수신 미확인 건은 요약에 다시 실리지 않는다.
 * 3. 주간 리포트 — 월요일(KST)에만, 지난주 실적을 전주와 비교해 메일로 보낸다
 *    (lib/orders/weekly-report). 이건 이상 유무와 관계없이 매주 보낸다.
 *
 * ※ Hobby 플랜은 크론이 하루 1회로 제한돼 새 크론을 늘리지 않고 여기에 얹었다.
 *
 * 환경변수:
 *   CRON_SECRET — Vercel Cron 인증. 미설정 시 개발=통과, 프로덕션=거부.
 */

import { auditUnconfirmedNotifies } from "@/lib/orders/notify-audit";
import { buildOpsDigest, formatDigestAlert, withLlmAlerts } from "@/lib/orders/ops-digest";
import { summarizeWeeks, isKstMonday, formatWeeklyReport } from "@/lib/orders/weekly-report";
import { getOrderStore } from "@/lib/orders";
import { checkLlmHealth } from "@/lib/report/llm-health";
import { sendOwnerAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "인증 실패" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "CRON_SECRET 미설정 — Vercel env에 추가하세요." },
      { status: 503 }
    );
  }

  const result = await auditUnconfirmedNotifies();

  // 요약이 실패해도 감사 결과는 돌려준다 — 감사가 이 크론의 본래 임무다
  let digest: { ok: boolean; alerts: string[]; alerted: boolean } | { error: string };
  try {
    const [d, llm] = await Promise.all([buildOpsDigest(), checkLlmHealth()]);
    const alerts = withLlmAlerts(d.alerts, llm);
    let alerted = false;
    if (alerts.length > 0) {
      const { subject, body } = formatDigestAlert(d, alerts);
      alerted = (await sendOwnerAlert(subject, body)).sent;
    }
    digest = { ok: alerts.length === 0, alerts, alerted };
  } catch (e) {
    console.error("[notify-audit] 운영 요약 실패:", e);
    digest = { error: e instanceof Error ? e.message : String(e) };
  }

  let weekly: { sent: boolean } | { error: string } | null = null;
  if (isKstMonday()) {
    try {
      const { subject, body } = formatWeeklyReport(
        summarizeWeeks(await getOrderStore().listOrders())
      );
      weekly = { sent: (await sendOwnerAlert(subject, body)).sent };
    } catch (e) {
      console.error("[notify-audit] 주간 리포트 실패:", e);
      weekly = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return Response.json({ status: "done", ...result, digest, weekly });
}
