/**
 * scripts/add-attribution-cols.ts
 * orders에 결제 금액·유입 경로 컬럼 추가 (1회성).
 *
 * 왜: 주문에 "얼마"와 "어디서"가 없어서, 매출도 유입 경로도 GA4를 봐야만 알 수 있었다.
 * GA4 표준 보고서는 확정에 24~48시간이 걸려서, 광고를 켜고 끌 판단이 이틀 늦게 왔다.
 * 결제되는 순간 DB에 남으면 그 지연이 사라진다.
 *
 * ⚠️ 컬럼명은 반드시 camelCase(따옴표 포함). Prisma가 snake_case를 못 찾아 운영이 깨진다.
 *
 * 실행: set -a; . ./.env.local; set +a; npx tsx scripts/add-attribution-cols.ts
 */
import { getPrisma } from "../lib/db";
import { REPORT_PRICE } from "../lib/pricing";

const COLUMNS: [string, string][] = [
  ["amountKrw", "integer"], // PG가 확인한 실제 결제 금액. 코드 상수로 계산하면 가격 변경 시 과거 매출까지 바뀐다.
  ["utmSource", "text"],
  ["utmMedium", "text"],
  ["utmCampaign", "text"],
  ["utmContent", "text"],
  ["referrer", "text"], // UTM이 없는 유입(검색·카톡)의 유일한 단서
  ["landingPath", "text"], // 첫 진입 경로 — /case 랜딩이 실제로 파는지 본다
];

async function main() {
  const db = getPrisma();

  for (const [name, type] of COLUMNS) {
    await db.$executeRawUnsafe(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS "${name}" ${type};`
    );
  }

  // 기존 결제 건은 전부 basic 단일 가격이었다 — 매출 화면이 과거를 0원으로 보여주지 않도록 채운다.
  // 환불 건도 채운다(결제는 실제로 일어났고, 매출 화면에서 환불을 따로 빼는 편이 정확하다).
  const filled = await db.$executeRawUnsafe(
    `UPDATE orders SET "amountKrw" = ${REPORT_PRICE}
     WHERE "paymentKey" IS NOT NULL AND "amountKrw" IS NULL;`
  );

  const cols = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='orders' AND column_name = ANY($1::text[])
     ORDER BY column_name;`,
    COLUMNS.map(([n]) => n)
  );

  console.log(`추가된 컬럼: ${cols.map((c) => c.column_name).join(", ")}`);
  console.log(`금액 채운 기존 주문: ${filled}건 (@${REPORT_PRICE.toLocaleString("ko-KR")}원)`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
