/**
 * lib/schools — 사실 레이어 진입점
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 * 두 레이어를 합치는 곳은 오직 lib/report 이다.
 *
 * 배정 결과는 항상 "예상 배정(교육청 확인 필요)" 라벨 + 출처·기준일 포함.
 */

import type { Coordinate, SchoolFacts, SchoolRecord, ZoneCollection } from "./types";
import type { SchoolFixture } from "./query";
import { geocodeAddress } from "./geocode";
import { findZoneByPoint, findZoneByPointFromDb, findNearbySchoolsFromDb } from "./zone";
import {
  findSchoolInFixtures,
  findSchoolByNameNearest,
  findNearbyInFixtures,
  findSchoolsByIdsFromDb,
} from "./query";

export type { SchoolFacts, SchoolRecord, Coordinate, ZoneCollection, ZoneFeature } from "./types";
export type { SchoolFixture } from "./query";
export { pointInGeoJsonGeometry, haversineDistanceM, findZoneByPoint } from "./zone";
export { geocodeAddress } from "./geocode";

/** getSchoolFacts() 옵션 */
export type GetSchoolFactsOptions = {
  /**
   * 지오코딩을 건너뛰고 직접 좌표를 전달한다.
   * (테스트·개발 시 API 키 없이 사용)
   */
  coord?: Coordinate;
  /**
   * 픽스처 모드: DB 대신 로컬 JSON 데이터로 조회한다.
   * (키 없이 파이프라인·테스트 실행 가능)
   */
  fixtureSchools?: SchoolFixture[];
  fixtureZones?: ZoneCollection;
};

/** 배정 학교 라벨 — 항상 이 값을 사용한다 */
export const ASSIGNED_SCHOOL_LABEL = "예상 배정(교육청 확인 필요)" as const;

/**
 * 주소 또는 좌표로 학교 사실 데이터를 조회한다.
 *
 * 동작:
 * 1. 좌표 결정: options.coord 우선, 없으면 geocodeAddress(address)
 * 2. 배정 예상 학교: 통학구역 point-in-polygon
 * 3. 학교군: 반경 2km 이내 학교
 * 4. 반환: SchoolFacts (항상 assignedLabel + 출처·기준일)
 *
 * 좌표를 얻을 수 없으면 빈 cluster로 반환한다.
 */
export async function getSchoolFacts(
  address: string,
  options: GetSchoolFactsOptions = {}
): Promise<SchoolFacts> {
  const emptyResult: SchoolFacts = {
    cluster: [],
    source: "좌표 변환 실패 — KAKAO_REST_API_KEY 확인 또는 coord 직접 전달 필요",
    asOf: new Date().toISOString().slice(0, 10),
  };

  // 1. 좌표 결정
  const coord: Coordinate | null =
    options.coord ?? (await geocodeAddress(address));

  if (!coord) return emptyResult;

  // 2. 픽스처 모드
  if (options.fixtureSchools && options.fixtureZones) {
    return getSchoolFactsFromFixtures(coord, options.fixtureSchools, options.fixtureZones);
  }

  // 3. DB 모드 (DATABASE_URL 필요)
  return getSchoolFactsFromDb(coord);
}

// ──────────────────────────────────────────────────────────────
// 픽스처 기반 (테스트·개발)
// ──────────────────────────────────────────────────────────────

async function getSchoolFactsFromFixtures(
  coord: Coordinate,
  schools: SchoolFixture[],
  zones: ZoneCollection
): Promise<SchoolFacts> {
  const zone = findZoneByPoint(coord, zones.features);
  const asOf = schools[0]?.asOf ?? new Date().toISOString().slice(0, 10);
  const source = schools[0]?.source ?? "샘플 픽스처";

  let assigned: SchoolFacts["assignedSchool"] | undefined;
  if (zone) {
    // 학구ID(Z…)와 학교ID(B…) 체계가 달라, 학교명+최근접으로 매칭.
    // (학구도연계정보 적재 시 ID 직접 조인으로 대체 가능)
    const rec =
      (zone.properties.schoolName
        ? findSchoolByNameNearest(zone.properties.schoolName, schools, coord)
        : null) ?? findSchoolInFixtures(zone.properties.schoolId, schools, coord);
    if (rec) {
      assigned = { ...rec, assignedLabel: ASSIGNED_SCHOOL_LABEL };
    }
  }

  const cluster = findNearbyInFixtures(coord, schools, 2000);

  return { assignedSchool: assigned, cluster, source, asOf };
}

// ──────────────────────────────────────────────────────────────
// DB 기반 (프로덕션)
// ──────────────────────────────────────────────────────────────

async function getSchoolFactsFromDb(coord: Coordinate): Promise<SchoolFacts> {
  const [zoneResult, nearbyRows] = await Promise.all([
    findZoneByPointFromDb(coord),
    findNearbySchoolsFromDb(coord, 2000),
  ]);

  let assigned: SchoolFacts["assignedSchool"] | undefined;
  if (zoneResult) {
    const rec = await findSchoolsByIdsFromDb([zoneResult.schoolId], coord);
    if (rec.length) {
      assigned = { ...rec[0], assignedLabel: ASSIGNED_SCHOOL_LABEL };
    }
  }

  const cluster = nearbyRows.map((r) => ({
    schoolId: r.schoolId,
    name: r.name,
    type: r.type,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    distanceM: Math.round(r.distanceM),
    ...(r.highSchoolType ? { highSchoolType: r.highSchoolType } : {}),
    source: r.source,
    asOf: r.asOf,
  } satisfies SchoolRecord));

  return {
    assignedSchool: assigned,
    cluster,
    source: "전국초등학교통학구역표준데이터(data.go.kr/data/15021149)",
    asOf: zoneResult?.asOf ?? new Date().toISOString().slice(0, 10),
  };
}
