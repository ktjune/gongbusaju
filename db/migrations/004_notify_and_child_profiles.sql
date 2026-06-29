-- 004_notify_and_child_profiles.sql
-- 컬럼명은 camelCase + 따옴표 (Prisma 매핑, @map 미사용 — 002_auth.sql 참고)

-- 결과 링크 발송 실패 기록 (어드민에서 보고 재발송)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "notifyError" TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "notifyFailedAt" TIMESTAMP(3);

-- 002_auth.sql의 child_profiles 테이블이 실제 DB에 한 번도 적용되지 않았던 것을 발견 — 재적용.
-- IF NOT EXISTS이므로 이미 있으면 안전하게 스킵된다.
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
