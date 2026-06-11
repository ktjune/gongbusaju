/**
 * lib/schools 사실 레이어 테스트
 *
 * DB·API 키 없이 샘플 픽스처(data-pipeline/fixtures/)로 동작한다.
 *
 * 절대 규칙: lib/schools 는 lib/saju 를 import 하지 않음 — ESLint로 강제.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  pointInGeoJsonGeometry,
  haversineDistanceM,
  findZoneByPoint,
  getSchoolFacts,
  ASSIGNED_SCHOOL_LABEL,
} from "../index";
import type { Coordinate, ZoneCollection, ZoneFeature } from "../types";
import type { SchoolFixture } from "../query";

// ──────────────────────────────────────────────────────────────
// 픽스처 로드 헬퍼
// ──────────────────────────────────────────────────────────────

const FIXTURES_DIR = resolve(__dirname, "../../../data-pipeline/fixtures");

function loadZones(): ZoneCollection {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, "sample_zones.geojson"), "utf8")
  ) as ZoneCollection;
}

function loadSchools(): SchoolFixture[] {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, "sample_schools.json"), "utf8")
  ) as SchoolFixture[];
}

// ──────────────────────────────────────────────────────────────
// 1. pointInGeoJsonGeometry — 순수 JS ray-casting
// ──────────────────────────────────────────────────────────────

describe("pointInGeoJsonGeometry — 순수 JS point-in-polygon", () => {
  // 간단한 정사각형 Polygon [lng_min, lat_min] ~ [lng_max, lat_max]
  // = [126.0, 37.0] ~ [127.0, 38.0]
  const squarePolygon: ZoneFeature = {
    type: "Feature",
    properties: {
      schoolId: "TEST",
      source: "test",
      asOf: "2024-01-01",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [126.0, 37.0],
          [127.0, 37.0],
          [127.0, 38.0],
          [126.0, 38.0],
          [126.0, 37.0], // 닫힌 링
        ],
      ],
    },
  };

  it("폴리곤 내부 좌표 → true", () => {
    expect(
      pointInGeoJsonGeometry({ lat: 37.5, lng: 126.5 }, squarePolygon.geometry)
    ).toBe(true);
  });

  it("폴리곤 외부 좌표 (동쪽) → false", () => {
    expect(
      pointInGeoJsonGeometry({ lat: 37.5, lng: 127.5 }, squarePolygon.geometry)
    ).toBe(false);
  });

  it("폴리곤 외부 좌표 (북쪽) → false", () => {
    expect(
      pointInGeoJsonGeometry({ lat: 38.5, lng: 126.5 }, squarePolygon.geometry)
    ).toBe(false);
  });

  it("MultiPolygon — 내부 좌표 → true", () => {
    const multi: ZoneFeature = {
      type: "Feature",
      properties: { schoolId: "TEST2", source: "test", asOf: "2024-01-01" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          // 폴리곤 1: 서쪽
          [[[125.0, 37.0], [126.0, 37.0], [126.0, 38.0], [125.0, 38.0], [125.0, 37.0]]],
          // 폴리곤 2: 동쪽
          [[[127.0, 37.0], [128.0, 37.0], [128.0, 38.0], [127.0, 38.0], [127.0, 37.0]]],
        ],
      },
    };
    // 서쪽 폴리곤 내부
    expect(pointInGeoJsonGeometry({ lat: 37.5, lng: 125.5 }, multi.geometry)).toBe(true);
    // 동쪽 폴리곤 내부
    expect(pointInGeoJsonGeometry({ lat: 37.5, lng: 127.5 }, multi.geometry)).toBe(true);
    // 두 폴리곤 사이 (외부)
    expect(pointInGeoJsonGeometry({ lat: 37.5, lng: 126.5 }, multi.geometry)).toBe(false);
  });

  it("구멍(hole) 있는 Polygon — 구멍 안 좌표 → false", () => {
    const donut: ZoneFeature = {
      type: "Feature",
      properties: { schoolId: "HOLE", source: "test", asOf: "2024-01-01" },
      geometry: {
        type: "Polygon",
        coordinates: [
          // 외부 링
          [[125.0, 37.0], [128.0, 37.0], [128.0, 39.0], [125.0, 39.0], [125.0, 37.0]],
          // 구멍
          [[126.0, 37.5], [127.0, 37.5], [127.0, 38.5], [126.0, 38.5], [126.0, 37.5]],
        ],
      },
    };
    // 외부 링 안 + 구멍 밖
    expect(pointInGeoJsonGeometry({ lat: 38.8, lng: 125.5 }, donut.geometry)).toBe(true);
    // 구멍 안 → false
    expect(pointInGeoJsonGeometry({ lat: 38.0, lng: 126.5 }, donut.geometry)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. haversineDistanceM
// ──────────────────────────────────────────────────────────────

describe("haversineDistanceM — 거리 계산", () => {
  it("동일 좌표 → 0m", () => {
    const c: Coordinate = { lat: 37.5665, lng: 126.978 };
    expect(haversineDistanceM(c, c)).toBe(0);
  });

  it("서울시청 ↔ 서울역 ≈ 1.5km", () => {
    const cityHall = { lat: 37.5665, lng: 126.9780 };
    const seoulStation = { lat: 37.5547, lng: 126.9707 };
    const dist = haversineDistanceM(cityHall, seoulStation);
    // 실제 직선 거리 약 1.4~1.6km
    expect(dist).toBeGreaterThan(1_000);
    expect(dist).toBeLessThan(2_000);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. findZoneByPoint — 픽스처 데이터 사용
// ──────────────────────────────────────────────────────────────

describe("findZoneByPoint — 샘플 픽스처 통학구역", () => {
  const zones = loadZones();

  it("청운초 구역 내부 좌표 → 청운초(B100000148)", () => {
    // 샘플 Zone A: lng 126.956~126.971, lat 37.578~37.591
    const coord: Coordinate = { lat: 37.584, lng: 126.964 };
    const zone = findZoneByPoint(coord, zones.features);
    expect(zone).not.toBeNull();
    expect(zone!.properties.schoolId).toBe("B100000148");
  });

  it("남산초 구역 내부 좌표 → 남산초(B100000208)", () => {
    // 샘플 Zone B: lng 126.978~126.991, lat 37.553~37.565
    const coord: Coordinate = { lat: 37.559, lng: 126.984 };
    const zone = findZoneByPoint(coord, zones.features);
    expect(zone).not.toBeNull();
    expect(zone!.properties.schoolId).toBe("B100000208");
  });

  it("어느 구역에도 속하지 않는 좌표 → null", () => {
    const coord: Coordinate = { lat: 37.65, lng: 127.10 };
    const zone = findZoneByPoint(coord, zones.features);
    expect(zone).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// 4. getSchoolFacts — 픽스처 모드 (DB·API 없이)
// ──────────────────────────────────────────────────────────────

describe("getSchoolFacts — 픽스처 모드", () => {
  const schools = loadSchools();
  const zones = loadZones();

  it("청운초 구역 좌표 → assignedSchool = 청운초", async () => {
    const result = await getSchoolFacts("서울특별시 종로구 청운동 (무시됨)", {
      coord: { lat: 37.584, lng: 126.964 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    expect(result.assignedSchool).toBeDefined();
    expect(result.assignedSchool!.name).toBe("청운초등학교");
  });

  it("배정 학교에 ASSIGNED_SCHOOL_LABEL 포함", async () => {
    const result = await getSchoolFacts("dummy", {
      coord: { lat: 37.584, lng: 126.964 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    expect(result.assignedSchool!.assignedLabel).toBe(ASSIGNED_SCHOOL_LABEL);
    expect(result.assignedSchool!.assignedLabel).toBe("예상 배정(교육청 확인 필요)");
  });

  it("구역 없는 좌표 → assignedSchool = undefined", async () => {
    const result = await getSchoolFacts("dummy", {
      coord: { lat: 37.65, lng: 127.10 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    expect(result.assignedSchool).toBeUndefined();
  });

  it("cluster 에 반경 내 학교 포함", async () => {
    // 청운초(37.584, 126.963)와 종로중(37.577, 126.970)이 좌표 근처에 있음
    const result = await getSchoolFacts("dummy", {
      coord: { lat: 37.580, lng: 126.965 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    expect(result.cluster.length).toBeGreaterThan(0);
  });

  it("cluster 가 거리순으로 정렬됨", async () => {
    const result = await getSchoolFacts("dummy", {
      coord: { lat: 37.580, lng: 126.965 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    for (let i = 1; i < result.cluster.length; i++) {
      expect(result.cluster[i].distanceM).toBeGreaterThanOrEqual(
        result.cluster[i - 1].distanceM
      );
    }
  });

  it("SchoolFacts에 source와 asOf 필드가 있음", async () => {
    const result = await getSchoolFacts("dummy", {
      coord: { lat: 37.584, lng: 126.964 },
      fixtureSchools: schools,
      fixtureZones: zones,
    });
    expect(typeof result.source).toBe("string");
    expect(result.source.length).toBeGreaterThan(0);
    expect(typeof result.asOf).toBe("string");
    expect(result.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("좌표 없음(geocoding 실패) → 빈 cluster 반환", async () => {
    // KAKAO_REST_API_KEY 없는 환경 → geocodeAddress() = null
    const result = await getSchoolFacts("서울특별시 어딘가");
    // coord 미전달, 키도 없음 → empty result
    expect(result.cluster).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. findSchoolByNameNearest — 학구ID↔학교ID 체계가 다를 때 이름 매칭
// ──────────────────────────────────────────────────────────────

describe("findSchoolByNameNearest — 학교명 + 최근접 매칭", () => {
  // 동명이교(청운초) 2곳 + 다른 학교 — 통학구역 ID와 무관하게 이름으로 매칭
  const fixtures: SchoolFixture[] = [
    { schoolId: "B1", name: "청운초등학교", type: "초등학교", address: "서울 종로", lat: 37.585, lng: 126.964, source: "s", asOf: "2026-03-20" },
    { schoolId: "B2", name: "청운초등학교", type: "초등학교", address: "강원 동해", lat: 37.485, lng: 129.104, source: "s", asOf: "2026-03-20" },
    { schoolId: "B3", name: "잠원초등학교", type: "초등학교", address: "서울 서초", lat: 37.512, lng: 127.012, source: "s", asOf: "2026-03-20" },
  ];

  it("동명 학교 중 요청 좌표에 가까운 쪽을 고른다", async () => {
    const { findSchoolByNameNearest } = await import("../query");
    const hit = findSchoolByNameNearest("청운초등학교", fixtures, { lat: 37.586, lng: 126.965 });
    expect(hit?.schoolId).toBe("B1"); // 서울 청운초 (강원 아님)
  });

  it("'서울' 접두 차이를 흡수해 매칭한다", async () => {
    const { findSchoolByNameNearest } = await import("../query");
    const hit = findSchoolByNameNearest("서울잠원초등학교", fixtures, { lat: 37.512, lng: 127.012 });
    expect(hit?.schoolId).toBe("B3");
  });

  it("일치하는 학교가 없으면 null (거짓 배정 방지)", async () => {
    const { findSchoolByNameNearest } = await import("../query");
    const hit = findSchoolByNameNearest("존재하지않는초등학교", fixtures, { lat: 37.5, lng: 127.0 });
    expect(hit).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// 6. ESLint 경계 규칙 검증 (런타임 테스트 아님, 가이드)
// ──────────────────────────────────────────────────────────────

// 이 파일에서 lib/saju 를 import 하면 ESLint 에러 발생.
// 아래 주석이 의도를 명확히 한다:
// import { computeSaju } from "../../saju"; // ← ESLint no-restricted-imports 에러
