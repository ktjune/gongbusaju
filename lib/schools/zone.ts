/**
 * lib/schools/zone.ts
 * 통학구역 point-in-polygon
 *
 * - 순수 JS 구현: 샘플 데이터·테스트에서 DB 없이 동작
 * - PostGIS 쿼리: 프로덕션 경로 (DATABASE_URL 필요)
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 */

import type {
  Coordinate,
  GeoJsonGeometry,
  GeoJsonLinearRing,
  GeoJsonPolygonCoords,
  GeoJsonMultiPolygonCoords,
  GeoJsonPosition,
  ZoneFeature,
} from "./types";

// ──────────────────────────────────────────────────────────────
// 순수 JS — Ray-Casting point-in-polygon
// ──────────────────────────────────────────────────────────────

/**
 * Ray-casting 알고리즘으로 점이 링(폐합 선) 안에 있는지 판단한다.
 * GeoJSON 좌표 순서([lng, lat])를 그대로 사용한다.
 */
function pointInRing(
  [px, py]: GeoJsonPosition,
  ring: GeoJsonLinearRing
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 점이 Polygon(외부 링 + 구멍들) 안에 있는지 판단한다.
 */
function pointInPolygonCoords(
  point: GeoJsonPosition,
  coords: GeoJsonPolygonCoords
): boolean {
  if (!pointInRing(point, coords[0])) return false;
  // 구멍(hole) 안에 있으면 false
  for (let h = 1; h < coords.length; h++) {
    if (pointInRing(point, coords[h])) return false;
  }
  return true;
}

/**
 * 점이 GeoJSON Geometry(Polygon 또는 MultiPolygon) 안에 있는지 판단한다.
 */
export function pointInGeoJsonGeometry(
  coord: Coordinate,
  geometry: GeoJsonGeometry
): boolean {
  const point: GeoJsonPosition = [coord.lng, coord.lat];

  if (geometry.type === "Polygon") {
    return pointInPolygonCoords(point, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as GeoJsonMultiPolygonCoords).some((poly) =>
      pointInPolygonCoords(point, poly)
    );
  }
  return false;
}

/**
 * Feature 컬렉션에서 좌표가 속하는 통학구역을 찾는다.
 * 여러 구역에 겹치면 첫 번째 매칭 반환.
 *
 * @param coord   검색 좌표
 * @param features ZoneFeature[]  (DB 결과 또는 샘플 픽스처)
 */
export function findZoneByPoint(
  coord: Coordinate,
  features: ZoneFeature[]
): ZoneFeature | null {
  return features.find((f) => pointInGeoJsonGeometry(coord, f.geometry)) ?? null;
}

// ──────────────────────────────────────────────────────────────
// Haversine 거리 (미터)
// ──────────────────────────────────────────────────────────────

/**
 * 두 WGS84 좌표 사이 직선 거리(미터)를 반환한다.
 */
export function haversineDistanceM(a: Coordinate, b: Coordinate): number {
  const R = 6_371_000; // 지구 반경 (m)
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const sinHφ = Math.sin(Δφ / 2);
  const sinHλ = Math.sin(Δλ / 2);
  const a2 =
    sinHφ * sinHφ + Math.cos(φ1) * Math.cos(φ2) * sinHλ * sinHλ;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

// ──────────────────────────────────────────────────────────────
// PostGIS 쿼리 (프로덕션 경로, DATABASE_URL 필요)
// ──────────────────────────────────────────────────────────────

export type DbZoneResult = {
  schoolId: string;
  name: string;
  type: string;
  address: string;
  distanceM: number;
  source: string;
  asOf: string;
};

/**
 * PostGIS에서 point-in-polygon으로 배정 예상 학교를 조회한다.
 * DATABASE_URL 환경변수가 없으면 null 반환.
 *
 * @returns 배정 예상 학교 또는 null (구역 없음 / DB 미연결)
 */
export async function findZoneByPointFromDb(
  coord: Coordinate
): Promise<DbZoneResult | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  // 동적 import — pg가 없는 테스트 환경에서 오류 방지
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query<DbZoneResult>(
      `SELECT * FROM find_assigned_school($1, $2)`,
      [coord.lat, coord.lng]
    );
    return rows[0] ?? null;
  } finally {
    await pool.end();
  }
}

/**
 * PostGIS에서 반경 내 학교군을 조회한다.
 * DATABASE_URL 환경변수가 없으면 [] 반환.
 */
export async function findNearbySchoolsFromDb(
  coord: Coordinate,
  radiusM = 2000
): Promise<DbZoneResult[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return [];

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: dbUrl });
  try {
    const { rows } = await pool.query<DbZoneResult>(
      `SELECT * FROM find_nearby_schools($1, $2, $3)`,
      [coord.lat, coord.lng, radiusM]
    );
    return rows;
  } finally {
    await pool.end();
  }
}
