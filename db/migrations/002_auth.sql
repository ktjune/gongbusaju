-- 002_auth.sql — 회원 시스템

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

CREATE TABLE IF NOT EXISTS child_profiles (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  nickname        TEXT NOT NULL,
  enc_birth_year  TEXT NOT NULL,
  enc_birth_month TEXT NOT NULL,
  enc_birth_day   TEXT NOT NULL,
  enc_birth_hour  TEXT,
  enc_birth_minute TEXT,
  enc_gender      TEXT NOT NULL,
  enc_address     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles(user_id);
