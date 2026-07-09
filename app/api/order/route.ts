/**
 * POST /api/order
 * 결제 성공 후 → 결제 승인 검증 → 주문 생성 (PII 암호화 저장, status=paid)
 *
 * 결제: 토스페이먼츠. 클라이언트가 결제위젯으로 결제 후 successUrl로 받은
 * paymentKey·tossOrderId·amount를 함께 전송하면, 서버가 시크릿 키로 승인 API를
 * 호출해 검증한 뒤에만 주문을 만든다. (TOSS_SECRET_KEY 미설정 시 모의 결제로 통과 — 개발용)
 *
 * Node 런타임 필수 (lib/crypto가 node:crypto 사용).
 */

import { waitUntil } from "@vercel/functions";
import { createOrder, generateReportForOrder } from "@/lib/orders";
import type { CreateOrderInput, Tier } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { confirmTossPayment, cancelTossPayment } from "@/lib/payments/toss";

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
  contactEmail?: string;
  contactPhone?: string;
  consent?: boolean;
  // 토스 결제 승인용 (성공 리다이렉트에서 전달)
  paymentKey?: string;
  tossOrderId?: string;
  amount?: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  // 법정대리인 동의 — PII 수집 전제 (개인정보보호법)
  if (!body.consent) {
    return Response.json(
      { error: "법정대리인 동의가 필요합니다." },
      { status: 400 }
    );
  }

  // 결제 승인 — TOSS_SECRET_KEY 설정 시 실결제 검증 필수.
  // (미설정 환경에서는 모의 결제로 통과 — 로컬 개발용)
  if (process.env.TOSS_SECRET_KEY) {
    if (!body.paymentKey || !body.tossOrderId || body.amount == null) {
      return Response.json({ error: "결제 정보가 없습니다." }, { status: 400 });
    }
    try {
      await confirmTossPayment({
        paymentKey: body.paymentKey,
        orderId: body.tossOrderId,
        amount: Number(body.amount),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "결제 승인에 실패했습니다.";
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
    contactEmail: body.contactEmail?.trim() || undefined,
    contactPhone: body.contactPhone?.trim() || undefined,
    userId: user?.id ?? undefined,
    // 실결제(TOSS_SECRET_KEY 설정 시)에서만 전달됨 — 환불(결제취소) 시 필요
    paymentKey: body.paymentKey,
  };

  try {
    const order = await createOrder(input);

    // 주문 생성 직후 백그라운드로 리포트 생성 시작.
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

    // 결제는 이미 승인됐는데 주문 생성이 실패하면 환불할 주문 레코드 자체가
    // 없는 "돈만 빠지는" 사고가 난다 — 즉시 결제취소를 시도해 막는다.
    if (body.paymentKey && process.env.TOSS_SECRET_KEY) {
      try {
        await cancelTossPayment(body.paymentKey, `주문 생성 실패 — 자동 환불: ${msg}`);
        return Response.json(
          { error: `${msg} (결제는 자동으로 환불 처리되었습니다)` },
          { status: 400 }
        );
      } catch (cancelErr) {
        console.error(
          `[order] 주문 생성 실패 후 자동 환불도 실패 — paymentKey: ${body.paymentKey}`,
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
