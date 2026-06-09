/**
 * data-pipeline/scripts/loadSchoolZones.ts
 * 통학구역 GeoJSON → DB(PostGIS) 적재
 *
 * 실행: DATABASE_URL=... npx tsx data-pipeline/scripts/loadSchoolZones.ts <geojsonPath>
 *
 * 데이터 소스:
 *   전국초등학교통학구역표준데이터  data.go.kr/data/15021149
 *   전국학교학구도연계정보표준데이터 data.go.kr/data/15021158
 *
 * 주의: 이 데이터의 통학구역은 "예상 배정(교육청 확인 필요)" 용도이며
 *       법적 효력이 없습니다. asOf와 source를 항상 기록합니다.
 */

import { readFileSync } from "fs";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

interface ZoneFeatureProperties {
  schoolId: string;
  schoolName?: string;
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

async function upsertZones(pool: Pool, collection: ZoneCollection, defaultAsOf: string) {
  for (const feat of collection.features) {
    const { schoolId, source, asOf } = feat.properties;
    if (!schoolId) continue;

    const geomGeoJson = JSON.stringify(feat.geometry);

    // MultiPolygon이 아닌 경우 ST_Multi로 감싼다
    const geomExpr =
      feat.geometry.type === "MultiPolygon"
        ? `ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)`
        : `ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))`;

    await pool.query(
      `INSERT INTO school_zones (school_id, geom, source, as_of)
       VALUES ($1, ${geomExpr}::geometry(MultiPolygon,4326), $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        schoolId,
        geomGeoJson, // $2 (not used in geomExpr above when MultiPolygon)
        geomGeoJson, // $3
        source ?? "전국초등학교통학구역표준데이터(data.go.kr/data/15021149)",
        asOf ?? defaultAsOf,
      ]
    );
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL 환경변수를 설정하세요.");
    process.exit(1);
  }

  const geojsonPath =
    process.argv[2] ??
    new URL("../fixtures/sample_zones.geojson", import.meta.url).pathname;

  const raw = readFileSync(geojsonPath, "utf8");
  const collection = JSON.parse(raw) as ZoneCollection;
  const defaultAsOf = new Date().toISOString().slice(0, 10);

  console.log(`피처 수: ${collection.features.length}`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await upsertZones(pool, collection, defaultAsOf);
    console.log("통학구역 적재 완료");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
