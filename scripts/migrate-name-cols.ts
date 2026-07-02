/**
 * scripts/migrate-name-cols.ts
 * subjects 테이블에 encName/encNameHanja 컬럼 추가 (1회성).
 * 실행: set -a; . ./.env.local; set +a; npx tsx scripts/migrate-name-cols.ts
 */
import { getPrisma } from "../lib/db";

async function main() {
  const db = getPrisma();
  await db.$executeRawUnsafe(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS "encName" text;`);
  await db.$executeRawUnsafe(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS "encNameHanja" text;`);
  const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='subjects' AND column_name IN ('encName','encNameHanja') ORDER BY column_name;`
  );
  console.log("현재 컬럼:", rows.map((r) => r.column_name).join(", ") || "(없음)");
  await db.$disconnect();
}
main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
