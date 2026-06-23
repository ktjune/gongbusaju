-- 002_auth.sql — 회원 시스템
-- 주의: 이 프로젝트의 Prisma 스키마는 컬럼명을 camelCase("userId")로 쓴다
-- (@map 미사용). 따라서 수기 마이그레이션도 반드시 camelCase + 따옴표로 작성한다.
-- (이전 버전은 snake_case(user_id)로 작성돼 Prisma가 컬럼을 못 찾아 주문 생성이 깨졌었다.)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "userId" TEXT;
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON orders("userId");

CREATE TABLE IF NOT EXISTS child_profiles (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "nickname"       TEXT NOT NULL,
  "encBirthYear"   TEXT NOT NULL,
  "encBirthMonth"  TEXT NOT NULL,
  "encBirthDay"    TEXT NOT NULL,
  "encBirthHour"   TEXT,
  "encBirthMinute" TEXT,
  "encGender"      TEXT NOT NULL,
  "encAddress"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "child_profiles_userId_idx" ON child_profiles("userId");
