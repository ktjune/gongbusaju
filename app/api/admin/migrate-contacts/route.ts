/**
 * POST /api/admin/migrate-contacts
 * 1회성 마이그레이션 — 평문으로 저장돼 있던 주문 연락처(contactEmail/Phone)를 암호화한다.
 *
 * 프로덕션 환경(올바른 PII_ENC_KEY)에서 실행되어야 하므로 어드민 API로 둔다.
 * 멱등: 이미 암호화("v1:")된 값은 건너뛴다. 반복 호출해도 안전.
 *
 * 인증: middleware.ts — admin 세션 필요.
 */
import { getPrisma } from "@/lib/db";
import { encryptPii } from "@/lib/crypto/pii";

export const runtime = "nodejs";

export async function POST() {
  const db = getPrisma();
  const rows = await db.order.findMany({
    select: { id: true, contactEmail: true, contactPhone: true },
  });

  let emailN = 0;
  let phoneN = 0;
  for (const r of rows) {
    const data: { contactEmail?: string; contactPhone?: string } = {};
    if (r.contactEmail && !r.contactEmail.startsWith("v1:")) {
      data.contactEmail = encryptPii(r.contactEmail);
      emailN++;
    }
    if (r.contactPhone && !r.contactPhone.startsWith("v1:")) {
      data.contactPhone = encryptPii(r.contactPhone);
      phoneN++;
    }
    if (Object.keys(data).length > 0) {
      await db.order.update({ where: { id: r.id }, data });
    }
  }

  return Response.json({
    ok: true,
    scanned: rows.length,
    encryptedEmail: emailN,
    encryptedPhone: phoneN,
  });
}
