/**
 * POST /api/refund-request — 고객 환불 요청 접수 (인증 불필요)
 * body: { orderId, contact, reason }
 *
 * 비회원 주문이라 로그인으로 본인을 확인할 수 없다. 주문번호 + 신청 시 입력한
 * 연락처가 모두 맞아야 접수된다. 요청만 기록하고 실제 환불은 운영자가 어드민에서
 * 실행한다(lib/orders/refund-request 참고).
 *
 * 공개 엔드포인트이므로 IP당 호출 횟수를 제한한다 — 주문번호를 무작위로 넣어
 * 남의 주문을 찾아내려는 시도를 늦추기 위해서다.
 */

import { submitRefundRequest } from "@/lib/orders";
import { sendOwnerAlert } from "@/lib/notify";

export const runtime = "nodejs";

/** IP당 허용 횟수와 시간창 — 정상 이용자는 몇 번이면 충분하다 */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10분

/**
 * 인스턴스 로컬 호출 기록. 서버리스에서는 인스턴스별로만 유효해 완벽하지 않지만,
 * 무차별 대입의 속도를 실질적으로 떨어뜨린다(정답 노출을 막는 본 방어는
 * "주문 없음/연락처 불일치를 구분하지 않는" 응답 설계 쪽이다).
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) {
    return Response.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let body: { orderId?: string; contact?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  try {
    const result = await submitRefundRequest({
      orderId: body.orderId ?? "",
      contact: body.contact ?? "",
      reason: body.reason ?? "",
    });

    // 운영자 알림 — 실패해도 접수 자체는 성공으로 응답한다(고객 입장에선 접수 완료)
    try {
      await sendOwnerAlert(
        "[공부결] 환불 요청 접수",
        `주문 ${result.orderId}에 환불 요청이 접수되었습니다.\n` +
          `사유: ${body.reason}\n\n` +
          `어드민 > 환불 요청에서 처리해 주세요.`
      );
    } catch (e) {
      console.error("[refund-request] 운영자 알림 실패", e);
    }

    return Response.json({
      orderId: result.orderId,
      refundRequestedAt: result.refundRequestedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "환불 요청 접수에 실패했습니다.";
    return Response.json({ error: msg }, { status: 400 });
  }
}
