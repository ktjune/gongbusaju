/**
 * data-pipeline/scripts/loadSchoolZones.ts
 * 통학구역 GeoJSON → DB(PostGIS) 적재
 *
 * 실행:
 *   DATABASE_URL=... npx tsx data-pipeline/scripts/loadSchoolZones.ts \
 *     <geojsonPath> --schools <schoolsJsonPath>
 *
 * 예:
 *   DATABASE_URL=... npx tsx data-pipeline/scripts/loadSchoolZones.ts \
 *     data-pipeline/output/zones.json \
 *     --schools data-pipeline/output/schools.json
 *
 * 데이터 소스:
 *   전국초등학교통학구역표준데이터  data.go.kr/data/15021149
 *
 * 주의:
 *   zones.json의 schoolId는 Z-코드(통학구역ID), schools.school_id는 B-코드(NEIS코드).
 *   두 체계가 달라 schoolName 기반으로 B-코드를 해결한다.
 *   이 데이터의 통학구역은 "예상 배정(교육청 확인 필요)" 용도이며 법적 효력 없음.
 */

import { readFileSync } from "fs";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// ── 타입 ────────────────────────────────────────────────────────

interface ZoneFeatureProperties {
  schoolId: string;       // Z-코드 (통학구역ID — schools FK에 사용 불가)
  schoolName?: string;    // 학교명 (B-코드 해결에 사용)
  zoneName?: string;
  source?: string;
  asOf?: string;
}

interface ZoneFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: ZoneFeatureProperties;
}

interface ZoneCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

interface SchoolFixture {
  schoolId: string;  // B-코드
  name: string;
  type: string;
  lat: number;
  lng: number;
}

// ── 공동통학구역 학교명 파싱 ────────────────────────────────────

/**
 * "능평초광주광명초공동(일방)" → ["능평초등학교", "광주광명초등학교"]
 *
 * 패턴: 여러 학교명이 "초"로 끝나는 형태로 이어 붙여지고, 끝에 "공동" 또는
 *       "공동(일방)" 등이 붙는다. "초" 경계로 분리 후 각각 "초등학교"로 복원.
 */
function parseGongdongNames(schoolName: string): string[] {
  // 접미사 제거
  const stripped = schoolName
    .replace(/공동(\(일방향?\))?$/, "")
    .trim();
  if (!stripped) return [];
  // "초" 경계로 분리
  return stripped
    .split("초")
    .filter(Boolean)
    .map((p) => p + "초등학교");
}

// ── Z코드 → B코드 해결 ──────────────────────────────────────────

/** 비교용 학교명 정규화 (공백·특수문자 제거) */
function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").replace(/[·•]/g, "");
}

/**
 * 폴리곤/멀티폴리곤의 중심 좌표를 근사한다 (외부 링 좌표 평균).
 * GeoJSON 좌표 순서는 [lng, lat].
 */
function approxCentroid(geometry: {
  type: string;
  coordinates: unknown;
}): { lat: number; lng: number } | null {
  let ring: number[][] | null = null;

  if (geometry.type === "Polygon") {
    ring = (geometry.coordinates as number[][][])[0];
  } else if (geometry.type === "MultiPolygon") {
    ring = (geometry.coordinates as number[][][][])[0][0];
  }
  if (!ring || ring.length === 0) return null;

  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lat: sumLat / ring.length, lng: sumLng / ring.length };
}

/** Haversine 거리 (m) */
function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * schools.json을 로드해 정규화 이름 → SchoolFixture[] 맵을 구성한다.
 * 초등학교만 포함 (통학구역은 초등학교 전용).
 */
function buildNameMap(schoolsPath: string): Map<string, SchoolFixture[]> {
  const schools = JSON.parse(readFileSync(schoolsPath, "utf8")) as SchoolFixture[];
  const map = new Map<string, SchoolFixture[]>();
  for (const s of schools) {
    if (s.type !== "초등학교") continue;
    const key = normalizeName(s.name);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return map;
}

/**
 * 학교명과 구역 중심 좌표를 기반으로 B-코드를 해결한다.
 * - 이름 정확 일치: 후보가 1개면 바로 반환, 여러 개면 중심 좌표 최근접
 * - 이름 접미 일치 (서울/경기 접두 흡수): 위와 동일
 * - 해결 불가: null 반환
 */
function resolveSchoolId(
  schoolName: string,
  centroid: { lat: number; lng: number } | null,
  nameMap: Map<string, SchoolFixture[]>
): string | null {
  const target = normalizeName(schoolName);
  if (!target) return null;

  // 1) 정확 일치
  let candidates = nameMap.get(target) ?? [];

  // 2) 접두 차이 흡수 (예: "서울개봉초등학교" ↔ "개봉초등학교")
  if (candidates.length === 0) {
    for (const [key, arr] of nameMap) {
      if (key.endsWith(target) || target.endsWith(key)) {
        candidates = candidates.concat(arr);
      }
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].schoolId;

  // 3) 중심 좌표 최근접으로 가린다
  if (!centroid) return candidates[0].schoolId; // fallback: 첫 번째
  return candidates.sort(
    (a, b) =>
      distanceM(centroid, { lat: a.lat, lng: a.lng }) -
      distanceM(centroid, { lat: b.lat, lng: b.lng })
  )[0].schoolId;
}

// ── DB 적재 ─────────────────────────────────────────────────────

async function upsertZones(
  pool: Pool,
  collection: ZoneCollection,
  nameMap: Map<string, SchoolFixture[]> | null,
  defaultAsOf: string
): Promise<{ loaded: number; skipped: number }> {
  let loaded = 0, skipped = 0;

  for (const feat of collection.features) {
    const { schoolId: zoneId, schoolName, source, asOf } = feat.properties;
    if (!zoneId) { skipped++; continue; }

    const centroid = approxCentroid(feat.geometry as { type: string; coordinates: unknown });
    const geomGeoJson = JSON.stringify(feat.geometry);
    const geomExpr =
      feat.geometry.type === "MultiPolygon"
        ? `ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)`
        : `ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))`;
    const src = source ?? "전국초등학교통학구역표준데이터(data.go.kr/data/15021149)";
    const asOfVal = asOf ?? defaultAsOf;

    // 해결할 학교ID 목록 (일반: 1개, 공동: 여러 개)
    let resolvedIds: string[] = [];

    if (nameMap && schoolName) {
      if (schoolName.includes("공동")) {
        // 공동통학구역: "능평초광주광명초공동" → 각 학교에 동일 구역 삽입
        const candidates = parseGongdongNames(schoolName);
        for (const nm of candidates) {
          const id = resolveSchoolId(nm, centroid, nameMap);
          if (id) resolvedIds.push(id);
        }
      } else {
        const id = resolveSchoolId(schoolName, centroid, nameMap);
        if (id) resolvedIds.push(id);
      }
    }

    if (resolvedIds.length === 0) {
      skipped++;
      if (skipped <= 10) {
        console.warn(`  [skip] 학교 미해결: ${schoolName ?? zoneId}`);
      } else if (skipped === 11) {
        console.warn("  ... (이후 skip 로그 생략)");
      }
      continue;
    }

    for (const resolvedId of resolvedIds) {
      try {
        await pool.query(
          `INSERT INTO school_zones (school_id, geom, source, as_of)
           VALUES ($1, ${geomExpr}::geometry(MultiPolygon,4326), $3, $4)
           ON CONFLICT DO NOTHING`,
          [resolvedId, geomGeoJson, src, asOfVal]
        );
        loaded++;
      } catch (e) {
        skipped++;
        const msg = e instanceof Error ? e.message : String(e);
        if (skipped <= 10) console.warn(`  [error] ${resolvedId}: ${msg}`);
      }
    }

    if ((loaded + skipped) % 500 === 0) {
      console.log(`  진행: ${loaded + skipped}/${collection.features.length} (로드 ${loaded}, skip ${skipped})`);
    }
  }

  return { loaded, skipped };
}

// ── main ────────────────────────────────────────────────────────

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL 환경변수를 설정하세요.");
    process.exit(1);
  }

  // 인자 파싱
  const args = process.argv.slice(2);
  const schoolsFlagIdx = args.indexOf("--schools");
  const schoolsPath = schoolsFlagIdx !== -1 ? args[schoolsFlagIdx + 1] : null;
  const geojsonPath =
    args[0] && !args[0].startsWith("--")
      ? args[0]
      : new URL("../fixtures/sample_zones.geojson", import.meta.url).pathname;

  const raw = readFileSync(geojsonPath, "utf8");
  const collection = JSON.parse(raw) as ZoneCollection;
  const defaultAsOf = new Date().toISOString().slice(0, 10);

  console.log(`피처 수: ${collection.features.length}`);
  console.log(`GeoJSON: ${geojsonPath}`);

  let nameMap: Map<string, SchoolFixture[]> | null = null;
  if (schoolsPath) {
    nameMap = buildNameMap(schoolsPath);
    console.log(`학교 이름 맵: 초등학교 ${[...nameMap.values()].reduce((s, a) => s + a.length, 0)}개`);
  } else {
    console.warn("--schools 미지정 → Z-코드 직접 사용 (FK 미검증, 샘플 전용)");
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { loaded, skipped } = await upsertZones(pool, collection, nameMap, defaultAsOf);
    console.log(`\n완료 — 로드: ${loaded}, 스킵: ${skipped}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
