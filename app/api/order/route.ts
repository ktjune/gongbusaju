/**
 * POST /api/order
 * 결제 성공 후 → 결제 승인 검증 → 주문 생성 (PII 암호화 저장, status=paid)
 *
 * 결제: 포트원(PortOne) V2 — PG는 채널 설정으로 결정(현재 NHN KCP).
 * 클라이언트가 결제를 마치고 paymentId를 보내오면, 서버가 API 시크릿으로
 * 결제 내역을 조회해 상태·금액을 검증한 뒤에만 주문을 만든다.
 * (PORTONE_API_SECRET 미설정 시 모의 결제로 통과 — 로컬 개발용)
 *
 * Node 런타임 필수 (lib/crypto가 node:crypto 사용).
 */

import { waitUntil } from "@vercel/functions";
import { createOrder, generateReportForOrder } from "@/lib/orders";
import { sendOrderConfirm, sendOwnerAlert } from "@/lib/notify";
import type { CreateOrderInput, Tier } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { verifyPortOnePayment, cancelPortOnePayment } from "@/lib/payments/portone";
import { isValidEmail, isValidKoreanMobile } from "@/lib/validate/contact";
import { sanitizeAttribution, describeChannel } from "@/lib/attribution";

export const runtime = "nodejs";
export const maxDuration = 300; // Pro: 300s, Hobby: 자동 60s 상한

type Body = {
  tier?: string;
  name?: string;
  nameHanja?: string;
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  birthHour?: number | null;
  birthMinute?: number | null;
  gender?: string;
  address?: string;
  currentSchool?: string;
  buyerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  consent?: boolean;
  /** 포트원 결제 식별자 — 결제 완료 후 클라이언트가 전달. 서버가 이걸로 검증한다. */
  paymentId?: string;
  /** 심사 모드 통행 토큰 — ORDER_GATE_TOKEN 설정 시에만 검사한다. */
  gateToken?: string;
  /** 유입 경로 — 클라이언트 sessionStorage에서 온다. 서버에서 걸러 쓴다(신뢰하지 않음). */
  attribution?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  // 심사 모드 잠금 — 테스트 채널(실제 출금 없음)로 운영에 올려둔 기간 동안
  // PG·카드사 심사자만 주문을 만들 수 있게 막는다. 실연동 채널로 바꾸면
  // ORDER_GATE_TOKEN을 지워서 해제한다.
  const gate = process.env.ORDER_GATE_TOKEN;
  if (gate && body.gateToken !== gate) {
    return Response.json(
      { error: "현재 결제 준비 중입니다. 곧 정식 오픈합니다." },
      { status: 403 }
    );
  }

  // 법정대리인 동의 — PII 수집 전제 (개인정보보호법)
  if (!body.consent) {
    return Response.json(
      { error: "법정대리인 동의가 필요합니다." },
      { status: 400 }
    );
  }

  // 리포트 전달용 연락처 — 이메일 또는 휴대폰 중 최소 하나 필수
  const emailInput = body.contactEmail?.trim() ?? "";
  const phoneInput = body.contactPhone?.trim() ?? "";
  if (!emailInput && !phoneInput) {
    return Response.json(
      { error: "리포트를 받으실 이메일 또는 휴대폰 중 하나를 입력해 주세요." },
      { status: 400 }
    );
  }
  // 입력한 연락처는 형식이 맞아야 함 (잘못된 주소로 발송 실패 방지)
  if (emailInput && !isValidEmail(emailInput)) {
    return Response.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (phoneInput && !isValidKoreanMobile(phoneInput)) {
    return Response.json({ error: "휴대폰 번호 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 결제 검증 — PORTONE_API_SECRET 설정 시 실결제 검증 필수.
  // (미설정 환경에서는 모의 결제로 통과 — 로컬 개발용)
  const paymentId = body.paymentId?.trim() ?? "";
  // PG가 확인해 준 실제 결제 금액. 매출 집계는 이 값으로 한다 —
  // 코드 상수로 계산하면 가격을 바꿨을 때 과거 매출까지 새 가격이 된다.
  // 모의 결제(로컬)는 undefined로 남겨 실제 매출과 구분한다.
  let paidAmountKrw: number | undefined;
  if (process.env.PORTONE_API_SECRET) {
    if (!paymentId) {
      return Response.json({ error: "결제 정보가 없습니다." }, { status: 400 });
    }
    try {
      // 상태(PAID)·금액(9,900원)을 PG 기록으로 직접 확인 — 클라이언트 값은 신뢰하지 않는다
      const payment = await verifyPortOnePayment(paymentId);
      paidAmountKrw = payment.amount?.total;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "결제 확인에 실패했습니다.";
      return Response.json({ error: msg }, { status: 402 });
    }
  }

  // 로그인 상태면 userId 연결 (마이페이지에서 내 주문 조회용)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const tier: Tier = "basic";

  const input: CreateOrderInput = {
    tier,
    subject: {
      birthYear: Number(body.birthYear),
      birthMonth: Number(body.birthMonth),
      birthDay: Number(body.birthDay),
      birthHour: body.birthHour == null ? undefined : Number(body.birthHour),
      birthMinute: body.birthMinute == null ? undefined : Number(body.birthMinute),
      gender: body.gender === "female" ? "female" : "male",
      address: body.address?.trim() || undefined,
      currentSchool: body.currentSchool?.trim() || undefined,
      // 이름은 표지·요약에 HTML로 삽입되므로 각괄호를 제거해 마크업 주입을 차단
      name: body.name?.trim().replace(/[<>]/g, "") || undefined,
      nameHanja: body.nameHanja?.trim().replace(/[<>]/g, "") || undefined,
    },
    buyerName: body.buyerName?.trim() || undefined,
    contactEmail: body.contactEmail?.trim() || undefined,
    contactPhone: body.contactPhone?.trim() || undefined,
    userId: user?.id ?? undefined,
    // paymentKey 컬럼에 포트원 paymentId를 저장한다 (컬럼명은 하위호환 유지).
    // 환불(결제취소) 시 이 값으로 PG를 호출한다.
    paymentKey: paymentId || undefined,
    amountKrw: paidAmountKrw,
    // 유입 경로 — 광고를 켜고 끌 판단을 GA4(확정까지 24~48시간)에 기대지 않으려고
    // 결제되는 순간 주문에 같이 박아둔다. 없어도 주문은 정상 진행된다.
    attribution: sanitizeAttribution(body.attribution),
  };

  try {
    const order = await createOrder(input);

    // 접수 확인을 먼저 보낸다. 리포트는 최대 1일이 걸리는데 그때까지 아무 연락이
    // 없으면 고객이 불안해하고, 무엇보다 **환불에 필요한 주문번호를 알 방법이 없다**
    // (결제 완료 화면에만 뜨고 창을 닫으면 사라진다).
    // 발송 실패가 주문을 되돌리면 안 되므로 결과를 삼킨다.
    waitUntil(
      sendOrderConfirm({
        orderId: order.id,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      }).catch((err: unknown) => {
        console.error(`[order] 접수 확인 발송 실패 — 주문: ${order.id}`, err);
      })
    );

    // 새 주문 알림 — 지금까지 정상 주문은 아무 신호도 없어서 어드민을 열어봐야 알았다.
    // 광고를 돌리는 동안은 "언제 어디서 팔렸는지"가 바로 와야 판단이 선다.
    // 개인정보는 넣지 않는다 — 금액·유입 경로·주문번호까지만.
    const amountLabel = paidAmountKrw
      ? `${paidAmountKrw.toLocaleString("ko-KR")}원`
      : "모의 결제";
    waitUntil(
      // 줄바꿈은 템플릿 리터럴의 실제 개행을 쓴다
      sendOwnerAlert(
        `새 주문 ${amountLabel}`,
        `주문번호: ${order.id}
금액: ${amountLabel}
유입: ${describeChannel(input.attribution ?? {})}
진입 경로: ${input.attribution?.landingPath ?? "-"}`
      ).catch((err: unknown) => {
        console.error(`[order] 새 주문 알림 실패 — 주문: ${order.id}`, err);
      })
    );


    // 리포트 생성은 백그라운드로.
    // waitUntil: 응답을 즉시 반환하고 생성(~40-50s)은 백그라운드에서 완료된다.
    waitUntil(
      generateReportForOrder(order.id).catch((err: unknown) => {
        console.error(`[order] 리포트 생성 실패 — 주문: ${order.id}`, err);
      })
    );

    return Response.json(
      { orderId: order.id, status: order.status, tier: order.tier },
      { status: 201 }
    );
  } catch (e) {
    // createOrder의 validateInput 에러는 사용자 입력 문제 → 400
    const msg = e instanceof Error ? e.message : "주문 생성에 실패했습니다.";

    // 결제는 이미 됐는데 주문 생성이 실패하면 환불할 주문 레코드 자체가
    // 없는 "돈만 빠지는" 사고가 난다 — 즉시 결제취소를 시도해 막는다.
    if (paymentId && process.env.PORTONE_API_SECRET) {
      try {
        await cancelPortOnePayment(paymentId, `주문 생성 실패 — 자동 환불: ${msg}`);
        return Response.json(
          { error: `${msg} (결제는 자동으로 환불 처리되었습니다)` },
          { status: 400 }
        );
      } catch (cancelErr) {
        console.error(
          `[order] 주문 생성 실패 후 자동 환불도 실패 — paymentId: ${paymentId}`,
          cancelErr
        );
        return Response.json(
          { error: `${msg} (자동 환불도 실패했습니다 — 고객센터로 문의해 주세요)` },
          { status: 400 }
        );
      }
    }

    return Response.json({ error: msg }, { status: 400 });
  }
}
