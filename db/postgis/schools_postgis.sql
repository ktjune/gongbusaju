-- ============================================================
-- 001_init.sql  —  공부사주 초기 스키마
-- Supabase Postgres + PostGIS
-- ============================================================

-- PostGIS 확장 활성화 (Supabase는 기본 활성화 여부 확인)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ------------------------------------------------------------
-- schools  학교 기본정보·위치
-- 출처: 전국초중등학교위치표준데이터 (data.go.kr/data/15021148)
--       전국초중등학교기본정보표준데이터 (data.go.kr/data/15107734)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id               BIGSERIAL PRIMARY KEY,
  school_id        TEXT        NOT NULL UNIQUE,  -- NEIS 학교 코드
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL,          -- '초등학교' | '중학교' | '고등학교'
  address          TEXT        NOT NULL,
  location         geometry(Point, 4326),         -- PostGIS WGS84 좌표
  high_school_type TEXT,                          -- 고교유형 (고등학교만): 일반/자율/특목/특성화
  source           TEXT        NOT NULL,          -- 공공데이터 출처 (URL 또는 데이터셋 ID)
  as_of            TEXT        NOT NULL,          -- 데이터 기준일 YYYY-MM-DD
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schools_location
  ON schools USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_schools_type
  ON schools (type);

-- ------------------------------------------------------------
-- school_zones  통학구역 폴리곤
-- 출처: 전국초등학교통학구역표준데이터 (data.go.kr/data/15021149)
--       전국학교학구도연계정보표준데이터 (data.go.kr/data/15021158)
--
-- 주의: "예상 배정(교육청 확인 필요)" — 법적 효력 없음
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_zones (
  id          BIGSERIAL PRIMARY KEY,
  school_id   TEXT        NOT NULL REFERENCES schools (school_id) ON DELETE CASCADE,
  geom        geometry(MultiPolygon, 4326) NOT NULL,  -- WGS84 폴리곤
  source      TEXT        NOT NULL,
  as_of       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_zones_school_id
  ON school_zones (school_id);

CREATE INDEX IF NOT EXISTS idx_school_zones_geom
  ON school_zones USING GIST (geom);

-- ------------------------------------------------------------
-- admission_stats  진학현황 (학교알리미 Open API — 후순위)
-- TODO: 학교알리미 데이터셋 ID 확인 후 구현
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admission_stats (
  id          BIGSERIAL PRIMARY KEY,
  school_id   TEXT        NOT NULL REFERENCES schools (school_id) ON DELETE CASCADE,
  year        INTEGER     NOT NULL,
  stat_key    TEXT        NOT NULL,  -- e.g. 'special_high_count', 'university_count'
  stat_value  NUMERIC,
  source      TEXT        NOT NULL,
  as_of       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, year, stat_key)
);

-- ============================================================
-- 편의 함수: point-in-polygon으로 통학구역 학교 조회
-- ============================================================
CREATE OR REPLACE FUNCTION find_assigned_school(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE (
  school_id        TEXT,
  name             TEXT,
  type             TEXT,
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  distance_m       DOUBLE PRECISION,
  high_school_type TEXT,
  source           TEXT,
  as_of            TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.school_id,
    s.name,
    s.type,
    s.address,
    ST_Y(s.location)           AS lat,
    ST_X(s.location)           AS lng,
    ST_Distance(
      s.location::geography,
      ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography
    )                          AS distance_m,
    s.high_school_type,
    sz.source,
    sz.as_of
  FROM school_zones sz
  JOIN schools s ON sz.school_id = s.school_id
  WHERE ST_Contains(
    sz.geom,
    ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
  )
  ORDER BY distance_m
  LIMIT 1;
$$;

-- ============================================================
-- 편의 함수: 반경 내 학교군 조회
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearby_schools(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius_m INTEGER DEFAULT 2000
)
RETURNS TABLE (
  school_id        TEXT,
  name             TEXT,
  type             TEXT,
  address          TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  distance_m       DOUBLE PRECISION,
  high_school_type TEXT,
  source           TEXT,
  as_of            TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.school_id,
    s.name,
    s.type,
    s.address,
    ST_Y(s.location)           AS lat,
    ST_X(s.location)           AS lng,
    ST_Distance(
      s.location::geography,
      ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography
    )                          AS distance_m,
    s.high_school_type,
    s.source,
    s.as_of
  FROM schools s
  WHERE ST_DWithin(
    s.location::geography,
    ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography,
    p_radius_m
  )
  ORDER BY distance_m
  LIMIT 10;
$$;
