/**
 * POST /api/order
 * 신청 폼 → 주문 생성 (PII 암호화 저장, status=paid)
 *
 * [모의 결제] PG(토스/카카오페이) 자격증명 연동 전까지, 결제 완료를 가정하고
 * 바로 paid 주문을 만든다. 실결제 연동 시 payment-webhook에서 createOrder를 호출.
 *
 * Node 런타임 필수 (lib/crypto가 node:crypto 사용).
 */

import { createOrder } from "@/lib/orders";
import type { CreateOrderInput, Tier } from "@/lib/orders";

export const runtime = "nodejs";

type Body = {
  tier?: string;
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

  const tier: Tier = body.tier === "premium" ? "premium" : "basic";

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
    },
    contactEmail: body.contactEmail?.trim() || undefined,
    contactPhone: body.contactPhone?.trim() || undefined,
  };

  try {
    const order = await createOrder(input);
    return Response.json(
      { orderId: order.id, status: order.status, tier: order.tier },
      { status: 201 }
    );
  } catch (e) {
    // createOrder의 validateInput 에러는 사용자 입력 문제 → 400
    const msg = e instanceof Error ? e.message : "주문 생성에 실패했습니다.";
    return Response.json({ error: msg }, { status: 400 });
  }
}
