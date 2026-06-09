/**
 * lib/schools/query.ts
 * 학교 정보 조회 — DB 또는 픽스처
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 */

import type { Coordinate, SchoolRecord } from "./types";
import { haversineDistanceM } from "./zone";

// ──────────────────────────────────────────────────────────────
// 픽스처 기반 조회 (개발·테스트 — DB 불필요)
// ──────────────────────────────────────────────────────────────

/** 픽스처 데이터 형식 (sample_schools.json 와 동일) */
export type SchoolFixture = {
  schoolId: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
  asOf: string;
};

/**
 * 픽스처 배열에서 특정 schoolId 의 SchoolRecord를 반환한다.
 */
export function findSchoolInFixtures(
  schoolId: string,
  fixtures: SchoolFixture[],
  requestCoord: Coordinate
): SchoolRecord | null {
  const f = fixtures.find((s) => s.schoolId === schoolId);
  if (!f) return null;
  return fixtureToRecord(f, requestCoord);
}

/**
 * 픽스처 배열에서 반경 내 학교를 거리순으로 반환한다.
 */
export function findNearbyInFixtures(
  coord: Coordinate,
  fixtures: SchoolFixture[],
  radiusM = 2000
): SchoolRecord[] {
  return fixtures
    .map((f) => fixtureToRecord(f, coord))
    .filter((r) => r.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

function fixtureToRecord(
  f: SchoolFixture,
  requestCoord: Coordinate
): SchoolRecord {
  return {
    schoolId: f.schoolId,
    name: f.name,
    type: f.type,
    address: f.address,
    lat: f.lat,
    lng: f.lng,
    distanceM: Math.round(
      haversineDistanceM(requestCoord, { lat: f.lat, lng: f.lng })
    ),
    source: f.source,
    asOf: f.asOf,
  };
}

// ──────────────────────────────────────────────────────────────
// DB 기반 조회 (프로덕션, DATABASE_URL 필요)
// ──────────────────────────────────────────────────────────────

/**
 * DB에서 schoolId 목록의 학교를 가져온다.
 * DATABASE_URL 없으면 [] 반환.
 */
export async function findSchoolsByIdsFromDb(
  schoolIds: string[],
  requestCoord: Coordinate
): Promise<SchoolRecord[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !schoolIds.length) return [];

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query<{
      school_id: string;
      name: string;
      type: string;
      address: string;
      lat: number;
      lng: number;
      source: string;
      as_of: string;
    }>(
      `SELECT school_id, name, type, address,
              ST_Y(location) AS lat, ST_X(location) AS lng,
              source, as_of
       FROM schools
       WHERE school_id = ANY($1)`,
      [schoolIds]
    );
    return rows.map((r) => ({
      schoolId: r.school_id,
      name: r.name,
      type: r.type,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      distanceM: Math.round(
        haversineDistanceM(requestCoord, { lat: r.lat, lng: r.lng })
      ),
      source: r.source,
      asOf: r.as_of,
    }));
  } finally {
    await pool.end();
  }
}
