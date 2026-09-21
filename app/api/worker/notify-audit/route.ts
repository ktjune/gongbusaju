/**
 * GET /api/worker/notify-audit — 발송했는데 수신 확인이 없는 주문을 운영자에게 알린다
 *
 * Vercel Cron이 하루 1회 호출한다 (vercel.json 참고).
 * 앞단(접수 검사·문자 폴백·발송 결과 웹훅)이 모두 놓친 건을 잡는 마지막 안전망이라
 * 평소에는 0건이어야 정상이다. 자세한 판정 기준은 lib/orders/notify-audit 참고.
 *
 * ※ 하루 1회는 Vercel Hobby의 크론 제약에 맞춘 것이다. Pro로 올리면
 *   schedule을 매시(`0 * * * *`)로 바꾸는 편이 낫다 — 그만큼 빨리 알게 된다.
 *
 * 환경변수:
 *   CRON_SECRET — Vercel Cron 인증. 미설정 시 개발=통과, 프로덕션=거부.
 */

import { auditUnconfirmedNotifies } from "@/lib/orders/notify-audit";

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
  return Response.json({ status: "done", ...result });
}
