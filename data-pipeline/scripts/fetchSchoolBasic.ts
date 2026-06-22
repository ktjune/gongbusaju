/**
 * data-pipeline/scripts/fetchSchoolBasic.ts
 * NEIS 교육정보 개방 포털 → 고등학교 기본정보(고교유형) 수집 및 schools.json 병기
 *
 * 실행: npx tsx data-pipeline/scripts/fetchSchoolBasic.ts [--dry-run]
 *   --dry-run : schools.json 수정 없이 수집 결과만 출력
 *
 * API: https://open.neis.go.kr/hub/schoolInfo
 *   KEY=NEIS_API_KEY, Type=json, SCHUL_KND_SC_NM=고등학교
 *   pSize=1000, 총 ~2,400건 → 3페이지
 *
 * 출력: data-pipeline/output/schools.json (highSchoolType 갱신)
 *   → loadSchools.ts 재실행으로 DB 반영
 *
 * 라이선스: NEIS 교육정보 개방 포털(open.neis.go.kr) — 공공저작물 자유이용허락
 *   출처 표시 조건으로 상업적 이용 가능 (제1유형 상당).
 *
 * 매칭: NEIS SD_SCHUL_CODE ↔ 15021148 schoolId(B-코드) 체계가 달라
 *   학교명 정규화(공백 제거) 후 정확 일치로 연결한다.
 *   고등학교 동명 학교는 드물어 이름 매칭으로 충분히 정확하다.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ENDPOINT = "https://open.neis.go.kr/hub/schoolInfo";
const PAGE_SIZE = 1000;
const CALL_DELAY_MS = 200;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const SCHOOLS_PATH = path.join(OUTPUT_DIR, "schools.json");

// ── 환경변수 로드 ────────────────────────────────────────────────

function loadApiKey(): string {
  if (process.env.NEIS_API_KEY) return process.env.NEIS_API_KEY;
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^NEIS_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("NEIS_API_KEY 없음 — .env.local에 설정하세요.");
}

// ── NEIS HS_SC_NM → highSchoolType 매핑 ─────────────────────────

const HS_TYPE_MAP: Record<string, string> = {
  "일반고": "일반고등학교",
  "특목고": "특수목적고등학교",
  "자율고": "자율고등학교",
  "특성화고": "특성화고등학교",
};

// ── NEIS API 수집 ────────────────────────────────────────────────

type NeisRow = {
  SCHUL_NM: string;
  SD_SCHUL_CODE: string;
  HS_SC_NM: string;
  FOND_SC_NM: string;
  COEDU_SC_NM: string;
  ATPT_OFCDC_SC_NM: string;
};

async function fetchPage(key: string, page: number): Promise<{ total: number; rows: NeisRow[] }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("KEY", key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", String(page));
  url.searchParams.set("pSize", String(PAGE_SIZE));
  url.searchParams.set("SCHUL_KND_SC_NM", "고등학교");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Record<string, unknown>;

  // 에러 응답 처리
  if (data.RESULT) {
    const result = data.RESULT as { CODE: string; MESSAGE: string };
    throw new Error(`NEIS 오류: ${result.CODE} — ${result.MESSAGE}`);
  }

  const info = (data.schoolInfo as Array<Record<string, unknown>>);
  if (!info) throw new Error("schoolInfo 필드 없음");

  const head = (info[0].head as Array<{ list_total_count?: number }>);
  const total = head?.[0]?.list_total_count ?? 0;
  const rows = (info[1]?.row ?? []) as NeisRow[];

  return { total, rows };
}

async function fetchAllHighSchools(key: string): Promise<NeisRow[]> {
  const first = await fetchPage(key, 1);
  const total = first.total;
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`NEIS 고등학교 총 ${total}건, ${pages}페이지`);

  const all: NeisRow[] = [...first.rows];

  for (let p = 2; p <= pages; p++) {
    await new Promise((r) => setTimeout(r, CALL_DELAY_MS));
    const { rows } = await fetchPage(key, p);
    all.push(...rows);
    console.log(`  페이지 ${p}/${pages} — 누적 ${all.length}건`);
  }

  return all;
}

// ── schools.json 병기 ────────────────────────────────────────────

type SchoolFixture = {
  schoolId: string;
  name: string;
  type: string;
  highSchoolType?: string;
  [key: string]: unknown;
};

function normalize(name: string): string {
  return name.replace(/\s+/g, "");
}

function mergeIntoSchools(
  neisRows: NeisRow[],
  dryRun: boolean
): { merged: number; notFound: number; typeMap: Record<string, number> } {
  const schools = JSON.parse(readFileSync(SCHOOLS_PATH, "utf8")) as SchoolFixture[];

  // NEIS 이름 → 고교유형 맵 구성
  const neisMap = new Map<string, string>();
  for (const r of neisRows) {
    const ht = HS_TYPE_MAP[r.HS_SC_NM];
    if (ht) neisMap.set(normalize(r.SCHUL_NM), ht);
  }

  // 분포 집계
  const typeMap: Record<string, number> = {};
  for (const ht of neisMap.values()) {
    typeMap[ht] = (typeMap[ht] ?? 0) + 1;
  }

  let merged = 0, notFound = 0;
  const updated = schools.map((s) => {
    if (s.type !== "고등학교") return s;
    const ht = neisMap.get(normalize(s.name));
    if (ht) {
      merged++;
      return { ...s, highSchoolType: ht };
    }
    notFound++;
    return s;
  });

  if (!dryRun) {
    writeFileSync(SCHOOLS_PATH, JSON.stringify(updated, null, 1), "utf8");
  }

  return { merged, notFound, typeMap };
}

// ── main ────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[dry-run] schools.json 수정 안 함");

  const key = loadApiKey();
  const rows = await fetchAllHighSchools(key);

  // 미매핑 HS_SC_NM 값 확인
  const unknownTypes = new Set(
    rows.filter((r) => r.HS_SC_NM && !HS_TYPE_MAP[r.HS_SC_NM]).map((r) => r.HS_SC_NM)
  );
  if (unknownTypes.size) {
    console.warn("⚠️  미매핑 HS_SC_NM 값:", [...unknownTypes]);
  }

  const { merged, notFound, typeMap } = mergeIntoSchools(rows, dryRun);

  console.log("\n결과:");
  console.log(`  병기 완료: ${merged}건`);
  console.log(`  미매칭:   ${notFound}건`);
  console.log("  유형 분포:", typeMap);

  if (!dryRun) {
    console.log(`\nschools.json 저장 완료 → loadSchools.ts로 DB 재적재하세요.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
