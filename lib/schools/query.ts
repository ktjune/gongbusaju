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

/** 픽스처 데이터 형식 (schools.json 와 동일) */
export type SchoolFixture = {
  schoolId: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  highSchoolType?: string;
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

/** 학교명 정규화 — 비교용 (공백 제거, 시·도 접두 무시) */
function normalizeSchoolName(name: string): string {
  return name.replace(/\s+/g, "");
}

/**
 * 학교명으로 픽스처에서 학교를 찾되, 요청 좌표에 가장 가까운 것을 반환한다.
 *
 * 통학구역 표준데이터의 학구ID(Z000…)와 학교위치표준데이터의 학교ID(B000…)는
 * 체계가 달라 직접 조인이 안 된다(학구도연계정보 필요). 그 전까지는 학교명으로
 * 잇되, 동명 학교(예: 전국의 '청운초등학교')는 통학구역 안의 좌표에 가장 가까운
 * 학교가 정답이므로 최근접으로 가린다.
 *
 * @returns 매칭 학교 또는 null (정확/부분일치 모두 실패 시 — 거짓 배정 대신 공백)
 */
export function findSchoolByNameNearest(
  schoolName: string,
  fixtures: SchoolFixture[],
  requestCoord: Coordinate
): SchoolRecord | null {
  const target = normalizeSchoolName(schoolName);
  if (!target) return null;

  const elementary = fixtures.filter((f) => f.type === "초등학교");

  // 1) 정확 일치
  let candidates = elementary.filter(
    (f) => normalizeSchoolName(f.name) === target
  );
  // 2) 접두("서울"…) 차이 흡수: 한쪽이 다른 쪽으로 끝나는 경우
  if (candidates.length === 0) {
    candidates = elementary.filter((f) => {
      const n = normalizeSchoolName(f.name);
      return n.endsWith(target) || target.endsWith(n);
    });
  }
  if (candidates.length === 0) return null;

  return candidates
    .map((f) => fixtureToRecord(f, requestCoord))
    .sort((a, b) => a.distanceM - b.distanceM)[0];
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
    ...(f.highSchoolType ? { highSchoolType: f.highSchoolType } : {}),
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
