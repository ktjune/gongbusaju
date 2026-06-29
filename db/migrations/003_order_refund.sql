-- 003_order_refund.sql — 환불 처리
-- 컬럼명은 camelCase + 따옴표 (Prisma 매핑, @map 미사용 — 002_auth.sql 참고)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "paymentKey" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "refundReason" TEXT;
