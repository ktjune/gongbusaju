/**
 * data-pipeline/scripts/fetchSchoolinfo.ts
 * 학교알리미 Open API → 학교 기본정보(공시항목 0) 수집
 *
 * 실행:
 *   npx tsx data-pipeline/scripts/fetchSchoolinfo.ts            # 전국 (257 시군구 × 3 학교급)
 *   npx tsx data-pipeline/scripts/fetchSchoolinfo.ts --sido 11  # 특정 시도만 (예: 서울)
 *
 * 출력: data-pipeline/output/schoolinfo_basic.json
 *   학교코드(SCHUL_CODE) 기준 — 설립구분·남녀공학·고교유형(특목/자사 등)·주소·좌표.
 *   위치표준데이터(schools.json)에 없는 속성을 보강한다 (고교유형이 Premium 핵심).
 *
 * API (OpenAPI_Developer_Guide / pnnggo_a01_l0.do 기준):
 *   GET https://www.schoolinfo.go.kr/openApi.do
 *     apiKey(필수), apiType=공시항목코드(기본정보=0),
 *     sidoCode·sggCode(2026년 신규 키는 필수), schulKndCode
 *
 * [주의] 가이드 문서의 학교급 코드(02유치원·03초등·04중·06고)는 실제와 다르다.
 * 실측(2026-06-11, 응답 SCHUL_KND_SC_CODE로 확증): 02=초등, 03=중, 04=고,
 * 05=특수, 06=방송통신중·고, 07=각종학교.
 *
 * [절대 규칙] 진학률 등 데이터 줄세우기 금지 — 이 스크립트는 원시 공시값만 저장한다.
 *
 * [⚠️ 라이선스 — 사용 보류] 학교알리미 학교기본정보는 공공누리 **제2유형(출처표시-변경금지)**.
 * 영리 서비스에서의 가공·2차적 저작물 작성이 금지되므로, 이 산출물(schoolinfo_basic*.json)은
 * git 미추적(.gitignore)이며 프로덕션에 사용하지 않는다.
 * 대체: data.go.kr 15107734 (전국초중등학교기본정보표준데이터, 제1유형=변경 자유) →
 * fetchSchoolBasic.ts로 수집 예정. 고교유형·남녀공학·설립유형 동일 제공.
 * 이 스크립트는 항목 구조 참조용으로만 보존한다.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ENDPOINT = "https://www.schoolinfo.go.kr/openApi.do";
const SOURCE_LABEL = "학교알리미 학교기본정보(schoolinfo.go.kr OpenAPI, 공시항목 0)";
const SCHOOL_KINDS = [
  { code: "02", label: "초등학교" },
  { code: "03", label: "중학교" },
  { code: "04", label: "고등학교" },
] as const;

/** 응답 SCHUL_KND_SC_CODE → 학교급명 (실측 기준) */
const KIND_NAME: Record<string, string> = {
  "02": "초등학교",
  "03": "중학교",
  "04": "고등학교",
  "05": "특수학교",
  "06": "방송통신중·고",
  "07": "각종학교",
};
const CALL_DELAY_MS = 150; // 호출 간격 (서버 예의)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");
const SIGUNGU_PATH = path.join(__dirname, "..", "fixtures", "sigungu_codes.json");

// ──────────────────────────────────────────────────────────────
// 환경변수 (.env.local 폴백)
// ──────────────────────────────────────────────────────────────

function loadApiKey(): string {
  if (process.env.SCHOOLINFO_API_KEY) return process.env.SCHOOLINFO_API_KEY;
  const envPath = path.join(__dirname, "..", "..", ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^SCHOOLINFO_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("SCHOOLINFO_API_KEY 없음 — .env.local 또는 환경변수에 설정하세요.");
}

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

type Sigungu = { sidoName: string; sidoCode: string; sggName: string; sggCode: string };

type RawSchool = Record<string, unknown>;

/** 저장 형식 — 원시 공시값 발췌 (가공·등급화 없음) */
type SchoolInfoRow = {
  schulCode: string;
  name: string;
  kind: string;           // 초등학교/중학교/고등학교
  foundation: string;     // 설립구분 (국립/공립/사립)
  coedu: string;          // 남녀공학 구분 (남/녀/남녀공학)
  highSchoolType: string; // 고교유형 (일반고/특목고/자사고 등 — 고교만)
  address: string;        // 도로명주소
  lat: number | null;
  lng: number | null;
  homepage: string;
  sidoCode: string;
  sggCode: string;
  source: string;
  asOf: string;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
};

// ──────────────────────────────────────────────────────────────
// API 호출
// ──────────────────────────────────────────────────────────────

async function fetchList(
  key: string,
  sgg: Sigungu,
  kindCode: string
): Promise<RawSchool[]> {
  const url =
    `${ENDPOINT}?apiKey=${key}&apiType=0` +
    `&sidoCode=${sgg.sidoCode}&sggCode=${sgg.sggCode}&schulKndCode=${kindCode}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${sgg.sggName}/${kindCode})`);
  const data = (await resp.json()) as {
    resultCode?: string;
    resultMsg?: string;
    list?: RawSchool[];
  };
  if (data.resultCode !== "success") {
    throw new Error(`API 오류 [${data.resultCode}] ${data.resultMsg} (${sgg.sggName}/${kindCode})`);
  }
  return data.list ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ──────────────────────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────────────────────

async function main() {
  const key = loadApiKey();
  const today = new Date().toISOString().slice(0, 10);

  const sidoFilter =
    process.argv.includes("--sido")
      ? process.argv[process.argv.indexOf("--sido") + 1]
      : null;

  const allSigungu = JSON.parse(readFileSync(SIGUNGU_PATH, "utf8")) as Sigungu[];
  const targets = sidoFilter
    ? allSigungu.filter((s) => s.sidoCode === sidoFilter)
    : allSigungu;

  console.log(
    `대상: 시군구 ${targets.length}곳 × 학교급 ${SCHOOL_KINDS.length} = ${targets.length * SCHOOL_KINDS.length}콜`
  );

  const byCode = new Map<string, SchoolInfoRow>();
  let calls = 0;
  let errors = 0;

  for (const sgg of targets) {
    for (const kind of SCHOOL_KINDS) {
      try {
        const list = await fetchList(key, sgg, kind.code);
        calls++;
        for (const raw of list) {
          // 폐교·휴교 제외
          if (str(raw.ABSCH_YN) === "Y" || str(raw.CLOSE_YN) === "Y") continue;
          const code = str(raw.SCHUL_CODE) || str(raw.SHL_IDF_CD);
          if (!code) continue;
          byCode.set(code, {
            schulCode: code,
            name: str(raw.SCHUL_NM),
            // 응답의 학교급 코드를 신뢰 (요청 코드는 가이드 오류 이력 있음)
            kind: KIND_NAME[str(raw.SCHUL_KND_SC_CODE)] ?? kind.label,
            foundation: str(raw.FOND_SC_CODE),
            coedu: str(raw.COEDU_SC_CODE),
            highSchoolType: str(raw.HS_KND_SC_NM),
            address: str(raw.SCHUL_RDNMA) || str(raw.ADRES_BRKDN),
            lat: num(raw.LTTUD),
            lng: num(raw.LGTUD),
            homepage: str(raw.HMPG_ADRES),
            sidoCode: sgg.sidoCode,
            sggCode: sgg.sggCode,
            source: SOURCE_LABEL,
            asOf: today,
          });
        }
      } catch (e) {
        errors++;
        console.error(`  ! ${(e as Error).message}`);
        if (errors > 20) throw new Error("오류 과다 — 중단");
      }
      await sleep(CALL_DELAY_MS);
    }
    if (calls % 30 === 0) {
      console.log(`  진행 ${calls}콜 — 누적 ${byCode.size}교`);
    }
  }

  const rows = [...byCode.values()];
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  console.log(`수집 완료: ${rows.length}교 (${calls}콜, 오류 ${errors})`);
  console.log("학교급 분포:", Object.fromEntries(byKind));

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const suffix = sidoFilter ? `_sido${sidoFilter}` : "";
  const outPath = path.join(OUTPUT_DIR, `schoolinfo_basic${suffix}.json`);
  writeFileSync(outPath, JSON.stringify(rows, null, 1), "utf8");
  console.log(`저장: ${outPath}`);
}

main().catch((e) => {
  console.error("수집 실패:", e.message);
  process.exit(1);
});
