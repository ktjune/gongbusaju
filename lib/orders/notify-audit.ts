/**
 * lib/orders/notify-audit.ts
 * "발송했는데 수신 확인이 없는" 주문을 찾아 운영자에게 알린다 — 마지막 안전망.
 *
 * 앞의 세 겹(접수 검사 · 문자 폴백 · 발송 결과 웹훅)이 다 새는 경우가 남는다.
 * 웹훅이 아예 오지 않는 경우다 — 콘솔에 URL을 등록하지 않았거나, 배포 중이라
 * 우리 쪽이 못 받았거나, 발송사가 재전송을 포기한 경우.
 * 그때도 "돈은 받았는데 고객은 못 받은" 상태가 조용히 남지 않게 한다.
 *
 * 대상은 연락처가 있는 발행 주문 전부다. 알림톡·문자는 솔라피 웹훅
 * (app/api/solapi-webhook), 이메일은 Resend 웹훅(app/api/resend-webhook)이
 * 수신을 확인해 주므로, 둘 중 어느 것도 오지 않은 건만 남는다.
 *
 * [주의] 두 웹훅이 콘솔에 등록돼 있어야 이 감사가 의미를 갖는다. 등록하지 않으면
 * 모든 주문이 "미확인"으로 걸려 매일 경보가 온다 — 그건 고장이 아니라 설정 누락이다.
 */

import { getOrderStore } from "./store";
import { sendOwnerAlert } from "../notify";

/** 발행 후 이 시간이 지나도 수신 확인이 없으면 이상으로 본다. */
export const UNCONFIRMED_AFTER_HOURS = 3;

export type NotifyAuditResult = {
  /** 경보 대상으로 걸린 주문 수 */
  found: number;
  /** 실제로 운영자 알림이 나간 수 */
  alerted: number;
  orderIds: string[];
};

export async function auditUnconfirmedNotifies(
  hours: number = UNCONFIRMED_AFTER_HOURS
): Promise<NotifyAuditResult> {
  const store = getOrderStore();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stale = await store.listUnconfirmedNotifies(cutoff);

  let alerted = 0;
  for (const order of stale) {
    // 먼저 표시해 둔다 — 알림이 실패해도 매일 같은 주문으로 다시 울리지 않게.
    // (알림 실패는 sendOwnerAlert가 결과로 돌려주고 로그에 남는다.)
    await store.markNotifyAudited(order.id);

    const result = await sendOwnerAlert(
      "결과 링크 수신 확인이 없습니다",
      `주문 ${order.id}는 ${hours}시간 전에 발행됐지만 아직 수신 확인이 오지 않았습니다.\n` +
        `이 고객은 연락처가 전화번호뿐이라 알림톡·문자가 유일한 통로입니다.\n` +
        `솔라피 콘솔의 발송 내역을 확인하고, 필요하면 어드민에서 재발송해 주세요.`
    );
    if (result.sent) alerted++;
  }

  if (stale.length > 0) {
    console.warn(
      `[notify-audit] 수신 미확인 ${stale.length}건 (알림 ${alerted}건): ${stale
        .map((o) => o.id)
        .join(", ")}`
    );
  }

  return { found: stale.length, alerted, orderIds: stale.map((o) => o.id) };
}
