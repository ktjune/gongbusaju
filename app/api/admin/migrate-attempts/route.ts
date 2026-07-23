/**
 * POST /api/admin/migrate-attempts — 일회성 마이그레이션 (실행 후 제거 예정)
 *
 * orders 테이블에 generateAttempts 컬럼 추가 — failed 주문 자동 재시도 횟수 상한용.
 * 로컬에서 프로덕션 DB 직접 접속이 안 되므로(ECONNREFUSED) 프로덕션 함수
 * 컨텍스트에서 DDL을 실행한다 (이전 migrate-contacts와 동일 패턴).
 *
 * 인증: middleware.ts — admin 세션
 */

import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const p = getPrisma();
  await p.$executeRawUnsafe(
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "generateAttempts" INTEGER NOT NULL DEFAULT 0`
  );
  // 적용 확인
  const rows = await p.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name = 'generateAttempts'`
  );
  return Response.json({ ok: true, columnExists: rows.length > 0 });
}
