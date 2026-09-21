/**
 * POST /api/solapi-webhook — 솔라피 발송 결과(리포트) 수신
 *
 * 왜 필요한가: 솔라피의 발송 API는 HTTP 200으로 **접수**만 답한다. 접수 후
 * 솔라피 1차 검토 → 카카오/이통사 전달에서 떨어지는 건은 응답에 나타나지 않고
 * 나중에 이 웹훅으로만 온다. 2026-09-16 주문(전화번호만 남긴 고객)의 알림톡이
 * 정확히 그 구간에서 사라졌고, 우리 DB에는 성공으로 남아 5일 동안 몰랐다.
 *
 * 어느 주문인지는 발송할 때 실어 보낸 customFields로 안다(lib/notify).
 *   orderId — 주문 식별자
 *   kind    — "result-ata" | "result-lms" | "confirm-lms"
 * 접수 확인 문자(confirm-lms)의 결과로 결과 링크가 도착했다고 적으면 안 되므로
 * result-* 만 주문의 수신 여부에 반영한다.
 *
 * 인증: 솔라피 콘솔에 등록하는 URL에 ?key=<SOLAPI_WEBHOOK_SECRET>을 붙인다.
 *   (솔라피 웹훅에는 공유 서명 헤더가 없어 URL 비밀값으로 막는다.
 *    미설정이면 프로덕션에서는 거부한다 — 열어두면 누구나 주문 상태를 덮어쓴다.)
 *
 * 응답은 항상 200으로 돌려준다 — 우리 쪽 사정으로 솔라피가 재전송을 반복하게
 * 만들 이유가 없다. 처리하지 못한 건은 로그로 남긴다.
 */

import { getOrderStore } from "@/lib/orders";
import type { Order } from "@/lib/orders";
import { sendOwnerAlert, sendResultLms, buildResultUrl, AUTO_RECOVERED_PREFIX } from "@/lib/notify";
import { safeCompare } from "@/lib/auth/admin-session";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 솔라피 상태코드 해석.
 *   1xxx 접수 실패 · 2xxx 정상 접수(아직 최종 아님) · 3xxx 발송/수신 실패 · 4xxx 수신 완료
 * 접두 한 자리로만 판정한다 — 개별 코드는 사유별로 계속 늘어나서 목록으로
 * 관리하면 새 코드가 나올 때마다 조용히 오판한다. 원본 코드는 로그·에러 문구에
 * 그대로 남겨 콘솔과 대조할 수 있게 한다.
 */
type Verdict = "delivered" | "failed" | "pending";

function verdictOf(statusCode: string | null): Verdict {
  if (!statusCode) return "pending";
  if (statusCode.startsWith("4")) return "delivered";
  if (statusCode.startsWith("2")) return "pending";
  return "failed"; // 1xxx · 3xxx · 그 밖의 모든 것
}

type Report = {
  messageId?: unknown;
  statusCode?: unknown;
  statusMessage?: unknown;
  customFields?: unknown;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function POST(req: Request) {
  const secret = process.env.SOLAPI_WEBHOOK_SECRET;
  if (secret) {
    const key = new URL(req.url).searchParams.get("key") ?? "";
    if (!(await safeCompare(key, secret))) {
      return Response.json({ error: "인증 실패" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[solapi-webhook] SOLAPI_WEBHOOK_SECRET 미설정 — 수신 거부");
    return Response.json({ error: "SOLAPI_WEBHOOK_SECRET 미설정" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  // 솔라피는 리포트를 배열로 보낸다. 단건 객체로 오는 경우도 받아준다.
  const reports: Report[] = Array.isArray(body) ? body : body ? [body] : [];
  if (reports.length === 0) {
    return Response.json({ status: "ignored", reason: "빈 페이로드" });
  }

  const store = getOrderStore();
  let applied = 0;

  for (const r of reports) {
    const fields = (r.customFields ?? {}) as Record<string, unknown>;
    const orderId = str(fields.orderId);
    const kind = str(fields.kind) ?? "";
    const statusCode = str(r.statusCode);
    const statusMessage = str(r.statusMessage) ?? "";
    const messageId = str(r.messageId) ?? "-";

    // 결과 링크 발송의 리포트만 주문의 수신 여부로 삼는다
    if (!orderId || !kind.startsWith("result")) continue;

    const verdict = verdictOf(statusCode);
    if (verdict === "pending") continue;

    const order = await store.getOrder(orderId);
    if (!order) {
      console.warn(`[solapi-webhook] 모르는 주문 — 무시: ${orderId} (messageId: ${messageId})`);
      continue;
    }

    if (verdict === "delivered") {
      await store.recordNotifyDelivery(orderId, { deliveredAt: new Date(), error: null });
      applied++;
      console.log(`[solapi-webhook] 수신 확인 — 주문: ${orderId}, ${kind}, ${statusCode}`);
      continue;
    }

    let reason = `${kind} 발송 실패 ${statusCode}: ${statusMessage}`.trim();
    console.error(`[solapi-webhook] ${reason} — 주문: ${orderId}`);

    // 이미 끝난 일이면 다시 손대지 않는다.
    //   · 다른 통로(이메일)가 닿았다 → 고객은 리포트를 받았다
    //   · 이미 문자로 되살렸다 → 그 문자의 수신 보고가 따로 온다
    // 여기서 실패로 덮어쓰면 "발송 실패" 큐에 없는 일이 생기고, 운영자가 재발송을
    // 눌러 고객이 같은 안내를 또 받는다.
    if (order.notifyDeliveredAt) {
      console.warn(`[solapi-webhook] 이미 다른 통로로 수신 확인됨 — 경보 생략: ${orderId}`);
      continue;
    }
    if ((order.notifyError ?? "").startsWith(AUTO_RECOVERED_PREFIX)) {
      console.warn(`[solapi-webhook] 이미 문자로 되살린 주문 — 경보 생략: ${orderId}`);
      continue;
    }

    /*
     * 알림톡이 카카오 단계에서 떨어졌고 문자가 유일하게 남은 통로면,
     * 사람을 기다리지 않고 여기서 바로 문자로 다시 보낸다.
     * 이게 없으면 운영자가 어드민을 열어 버튼을 누를 때까지 고객은 아무것도 못 받는다.
     *
     * 폴백은 알림톡(result-ata) 실패에만 건다 — 문자(result-lms) 실패에 또 문자를
     * 보내면 끝없이 돈다. 같은 리포트가 두 번 와도(솔라피 재전송) 두 번 보내지
     * 않도록, 이미 재발송한 주문은 notifyError에 남은 표시로 걸러낸다.
     */
    if (canFallbackToLms(kind, order)) {
      const lmsError = await resendByLms(order);
      if (lmsError === null) {
        // 사람이 할 일이 없으므로 운영자 알림은 보내지 않는다. 기록만 남긴다 —
        // 문자의 수신 보고(result-lms)가 도착하면 이 기록은 자동으로 지워진다.
        await store.recordNotifyDelivery(orderId, {
          deliveredAt: null,
          error: `${AUTO_RECOVERED_PREFIX} ${reason} → 문자 재발송함`,
        });
        applied++;
        console.warn(`[solapi-webhook] 알림톡 실패 → 문자로 재발송 — 주문: ${orderId}`);
        continue;
      }
      reason = `${reason} / 문자 재발송도 실패: ${lmsError}`;
      console.error(`[solapi-webhook] 문자 재발송 실패 — 주문: ${orderId}`, lmsError);
    }

    await store.recordNotifyDelivery(orderId, { deliveredAt: null, error: reason });
    applied++;

    // 여기까지 왔으면 자동으로 할 수 있는 게 없다 — 사람이 바로 알아야 한다.
    await sendOwnerAlert(
      "결과 링크가 고객에게 닿지 않았습니다",
      `주문 ${orderId}의 결과 링크 발송이 실패로 확인됐습니다.\n` +
        `사유: ${reason}\n` +
        `어드민 "발송 실패" 큐에서 재발송하거나 직접 연락해 주세요.`
    );
  }

  return Response.json({ status: "done", received: reports.length, applied });
}

/**
 * 알림톡 실패에 문자로 되받아칠 수 있는 상황인가.
 *
 * 이메일이 있는 고객은 이미 이메일로 링크를 받았으므로 문자를 겹쳐 보내지 않는다
 * (sendResultLink의 판단과 같다 — 비용·성가심만 는다).
 */
function canFallbackToLms(kind: string, order: Order): boolean {
  // 이미 되살린 건은 위에서 걸러졌으므로 여기서 또 볼 필요가 없다.
  return (
    kind === "result-ata" && !order.contactEmail && !!order.contactPhone && !!order.reportId
  );
}

/** 결과 링크를 문자로 다시 보낸다. 성공하면 null, 실패하면 사유. */
async function resendByLms(order: Order): Promise<string | null> {
  const report = await getOrderStore().getReport(order.reportId!);
  if (!report) return "리포트를 찾을 수 없음";

  return sendResultLms(order.id, buildResultUrl(report.token), order.contactPhone!).then(
    () => null,
    (err: unknown) => (err instanceof Error ? err.message : String(err))
  );
}
