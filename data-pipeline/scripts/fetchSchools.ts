/**
 * data-pipeline/scripts/fetchSchools.ts
 * 전국초중등학교위치표준데이터 Open API → 픽스처 JSON 수집
 *
 * 실행: npx tsx data-pipeline/scripts/fetchSchools.ts [--inspect]
 *   --inspect : 첫 페이지 1건의 원본 필드명만 출력 (매핑 확인용)
 *
 * 출력: data-pipeline/output/schools.json (lib/schools SchoolFixture[] 형식)
 *   → DB(PostGIS) 적재 전에도 픽스처 모드로 실데이터 조회 가능.
 *   → DB 적재는 loadSchools.ts가 담당 (Supabase 준비 후).
 *
 * API: https://api.data.go.kr/openapi/tn_pubr_public_elesch_mskul_lc_api
 *   일일 트래픽 1,000건 — numOfRows=1000으로 전국(약 1.2만교) ≒ 12~13콜.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ENDPOINT =
  "https://api.data.go.kr/openapi/tn_pubr_public_elesch_mskul_lc_api";
const SOURCE_LABEL =
  "전국초중등학교위치표준데이터(data.go.kr/data/15021148)";
const ROWS_PER_PAGE = 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// ──────────────────────────────────────────────────────────────
// 환경변수 (.env.local 폴백 — tsx는 .env를 자동 로드하지 않음)
// ──────────────────────────────────────────────────────────────

function loadApiKey(): string {
  if (process.env.DATA_GO_KR_API_KEY) return process.env.DATA_GO_KR_API_KEY;
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(
      /^DATA_GO_KR_API_KEY=(.+)$/m
    );
    if (m) return m[1].trim();
  }
  throw new Error(
    "DATA_GO_KR_API_KEY 없음 — .env.local 또는 환경변수에 설정하세요."
  );
}

// ──────────────────────────────────────────────────────────────
// 응답 필드 매핑 — 표준데이터 API 필드명 후보를 순서대로 시도
// ──────────────────────────────────────────────────────────────

type RawItem = Record<string, unknown>;

function pick(item: RawItem, candidates: string[]): string {
  for (const key of candidates) {
    const v = item[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

/** 공공데이터 개방 표준(학교위치) 필드명 후보 */
const FIELD = {
  schoolId: ["schoolId", "schoolCode", "sclCode", "스쿨ID", "학교ID", "학교코드"],
  name: ["schoolNm", "schoolName", "schlNm", "학교명"],
  type: ["schoolSe", "schoolKndNm", "schoolKnd", "schulKndScNm", "학교급구분", "학교종류명"],
  address: ["rdnmadr", "roadNmAddr", "lnmadr", "도로명주소", "소재지도로명주소", "소재지지번주소"],
  lat: ["latitude", "lat", "위도"],
  lng: ["longitude", "lot", "lng", "경도"],
  asOf: ["referenceDate", "baseDate", "데이터기준일자"],
} as const;

type SchoolFixtureRow = {
  schoolId: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  source: string;
  asOf: string;
};

function mapItem(item: RawItem, fallbackAsOf: string): SchoolFixtureRow | null {
  const lat = parseFloat(pick(item, [...FIELD.lat]));
  const lng = parseFloat(pick(item, [...FIELD.lng]));
  const row: SchoolFixtureRow = {
    schoolId: pick(item, [...FIELD.schoolId]),
    name: pick(item, [...FIELD.name]),
    type: pick(item, [...FIELD.type]),
    address: pick(item, [...FIELD.address]),
    lat,
    lng,
    source: SOURCE_LABEL,
    asOf: pick(item, [...FIELD.asOf]) || fallbackAsOf,
  };
  if (!row.schoolId || !row.name || isNaN(lat) || isNaN(lng)) return null;
  // 한국 영역 좌표 검증 (위도 33~39, 경도 124~132)
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;
  return row;
}

// ──────────────────────────────────────────────────────────────
// API 호출
// ──────────────────────────────────────────────────────────────

type ApiBody = {
  totalCount?: number | string;
  items?: RawItem[] | { item?: RawItem[] };
};

async function fetchPage(
  key: string,
  pageNo: number
): Promise<{ items: RawItem[]; totalCount: number }> {
  const url = `${ENDPOINT}?serviceKey=${key}&pageNo=${pageNo}&numOfRows=${ROWS_PER_PAGE}&type=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    response?: { header?: { resultCode?: string; resultMsg?: string }; body?: ApiBody };
  };

  const header = data.response?.header;
  if (header?.resultCode !== "00") {
    throw new Error(
      `API 오류 [${header?.resultCode}] ${header?.resultMsg ?? "(메시지 없음)"}`
    );
  }

  const body = data.response?.body ?? {};
  const rawItems = Array.isArray(body.items)
    ? body.items
    : (body.items as { item?: RawItem[] } | undefined)?.item ?? [];
  return {
    items: rawItems,
    totalCount: Number(body.totalCount ?? 0),
  };
}

// ──────────────────────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────────────────────

async function main() {
  const key = loadApiKey();
  const inspect = process.argv.includes("--inspect");
  const today = new Date().toISOString().slice(0, 10);

  const first = await fetchPage(key, 1);
  console.log(`totalCount = ${first.totalCount}`);

  if (inspect) {
    console.log("첫 건 원본 필드:");
    console.log(JSON.stringify(first.items[0], null, 2));
    return;
  }

  const all: SchoolFixtureRow[] = [];
  let skipped = 0;

  const collect = (items: RawItem[]) => {
    for (const item of items) {
      const row = mapItem(item, today);
      if (row) all.push(row);
      else skipped++;
    }
  };

  collect(first.items);
  const totalPages = Math.ceil(first.totalCount / ROWS_PER_PAGE);
  for (let page = 2; page <= totalPages; page++) {
    const { items } = await fetchPage(key, page);
    collect(items);
    console.log(`페이지 ${page}/${totalPages} — 누적 ${all.length}건`);
  }

  // 통계
  const byType = new Map<string, number>();
  for (const r of all) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  console.log("학교급 분포:", Object.fromEntries(byType));
  if (skipped > 0) console.log(`매핑 실패/좌표 불량 스킵: ${skipped}건`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, "schools.json");
  writeFileSync(outPath, JSON.stringify(all, null, 1), "utf8");
  console.log(`저장: ${outPath} (${all.length}건)`);
}

main().catch((e) => {
  console.error("수집 실패:", e.message);
  process.exit(1);
});
