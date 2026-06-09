/**
 * data-pipeline/scripts/loadSchools.ts
 * 학교 기본정보·위치 CSV → DB 적재
 *
 * 실행: DATABASE_URL=... npx tsx data-pipeline/scripts/loadSchools.ts <csvPath>
 *
 * 데이터 소스:
 *   전국초중등학교위치표준데이터  data.go.kr/data/15021148
 *   전국초중등학교기본정보표준데이터 data.go.kr/data/15107734
 *
 * CSV 예상 컬럼(공공데이터포털 표준):
 *   학교코드, 학교명, 학교종류명, 도로명주소, 위도, 경도, ...
 */

import { readFileSync } from "fs";
import { Pool } from "pg";

// .env 우선, 없으면 환경변수 직접 참조
const DATABASE_URL = process.env.DATABASE_URL;

interface SchoolRow {
  schoolId: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
  asOf: string;
}

/**
 * 공공데이터포털 학교 CSV 파싱 (UTF-8 또는 EUC-KR 필요 시 변환 후 사용)
 * 컬럼 순서: 학교코드, 학교명, 학교종류명, 도로명주소, 위도, 경도
 */
function parseCsv(csvContent: string, asOf: string): SchoolRow[] {
  const lines = csvContent.split("\n").slice(1); // 헤더 제거
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        schoolId: cols[0],
        name: cols[1],
        type: cols[2],
        address: cols[3],
        lat: parseFloat(cols[4]),
        lng: parseFloat(cols[5]),
        source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148)",
        asOf,
      };
    })
    .filter((r) => r.schoolId && r.name && !isNaN(r.lat) && !isNaN(r.lng));
}

async function upsertSchools(pool: Pool, rows: SchoolRow[]): Promise<void> {
  for (const row of rows) {
    await pool.query(
      `INSERT INTO schools (school_id, name, type, address, location, source, as_of)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_Point($6, $5), 4326), $7, $8)
       ON CONFLICT (school_id) DO UPDATE SET
         name     = EXCLUDED.name,
         type     = EXCLUDED.type,
         address  = EXCLUDED.address,
         location = EXCLUDED.location,
         source   = EXCLUDED.source,
         as_of    = EXCLUDED.as_of`,
      [row.schoolId, row.name, row.type, row.address, row.lat, row.lng, row.source, row.asOf]
    );
  }
}

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL 환경변수를 설정하세요.");
    process.exit(1);
  }

  const csvPath = process.argv[2];
  if (!csvPath) {
    // 파라미터 없으면 샘플 데이터로 실행
    console.log("CSV 경로 미지정 → 샘플 픽스처로 실행 (개발용)");
    const sample = JSON.parse(
      readFileSync(
        new URL("../fixtures/sample_schools.json", import.meta.url).pathname,
        "utf8"
      )
    ) as SchoolRow[];

    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
      await upsertSchools(pool, sample);
      console.log(`샘플 학교 ${sample.length}개 적재 완료`);
    } finally {
      await pool.end();
    }
    return;
  }

  const csvContent = readFileSync(csvPath, "utf8");
  const asOf = new Date().toISOString().slice(0, 10);
  const rows = parseCsv(csvContent, asOf);
  console.log(`파싱된 학교 수: ${rows.length}`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await upsertSchools(pool, rows);
    console.log("적재 완료");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
