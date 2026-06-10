/**
 * lib/report/template.ts
 * 사실 블록 / 데이터 블록 / 관점 블록 분리 템플릿
 *
 * [절대 규칙]
 * - 학교명·수치 등 학교 사실은 buildFactBlock()(코드)가 생성한다. LLM에게 전달되지 않는다.
 * - 배정 학교는 항상 ASSIGNED_LABEL + 출처·기준일을 붙인다.
 * - 사주 데이터 섹션(원국 표·오행·십성·기질·대운 타임라인)도 코드가 생성한다.
 *   LLM은 해석 산문(PerspectiveBlock)만 작성한다.
 * - 모든 블록은 assembleReport()에서 나란히 배치된다.
 *   "오행이 X라 이 학교가 정답" 같은 인과 연결은 어디에도 없다.
 */

import type { SajuResult } from "../saju";
import {
  ganjiToHangul,
  withHangul,
  tenGodWithHangul,
  wuxingToHangul,
  tenGodOf,
  branchMainStem,
  formatDaeunAge,
} from "../saju";
import type { SchoolFacts, SchoolRecord } from "../schools";

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

/** 만세력 계산 기준 표기 — 모든 리포트 하단 필수 포함 */
export const TIME_STANDARD_NOTICE =
  "본 리포트의 사주 계산 기준: 일주·시주는 동경 127.5° 경도 보정(-30분), " +
  "연주·월주는 한국천문연구원(KASI) 절입시각(KST)을 따릅니다.";

/** 해석 면책 표기 — 모든 리포트 하단 필수 포함 */
export const INTERPRETATION_NOTICE =
  "본 리포트의 기질·대운 해석은 사주 명리의 관점이며, 실측된 심리·적성 검사 결과가 아닙니다. " +
  "아이의 실제 모습과 보호자의 판단이 항상 우선합니다.";

/** 학교 배정 결과에 항상 붙이는 라벨 */
export const ASSIGNED_SCHOOL_LABEL = "예상 배정(교육청 확인 필요)";

// ──────────────────────────────────────────────────────────────
// 블록 타입
// ──────────────────────────────────────────────────────────────

/**
 * 사실 블록 — 학교 정보 텍스트.
 * 코드(buildFactBlock)가 생성한다. LLM에게 전달되지 않으며 수정도 불가.
 */
export type FactBlock = {
  /** 예상 배정 학교 섹션 (코드 생성) */
  assignedSchoolSection?: string;
  /** 반경 2km 이내 학교군 섹션 (코드 생성) */
  clusterSection?: string;
};

/**
 * 관점(해석) 블록 — LLM이 작성하는 산문.
 * 학교 사실(이름·주소·거리·진학률)을 포함해서는 안 된다.
 */
export type PerspectiveBlock = {
  /** 일간(日干) — 아이의 타고난 본질 해석 산문 */
  dayMasterProse: string;
  /** 오행 밸런스 — 강한/약한 기운이 공부·생활에서 드러나는 방식 */
  elementsProse: string;
  /** 십성 구조 — 두드러진 십성이 뜻하는 마음의 습관 */
  tenGodsProse: string;
  /** 공부 스타일 — 학습 환경·습관·과목 접근 방식 제안 */
  studyStyleProse: string;
  /** 부모 코칭 — 보호자가 참고할 양육 포인트 */
  parentingProse: string;
  /** 학령기 대운 흐름 해석 산문 */
  daeunProse: string;
  /**
   * [Premium] 학교 선택 시 기질 관점에서 참고할 경향 산문.
   * 학교명·사실 절대 포함 금지.
   */
  schoolConnectionProse?: string;
};

// ──────────────────────────────────────────────────────────────
// 데이터 블록 빌더 — 사주 계산값을 표로 변환. 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/** 원국 표 — 4기둥 천간·지지 + 글자별 십성(지지는 본기 기준) */
export function buildSajuTableSection(saju: SajuResult): string {
  const { pillars } = saju;
  const dayStem = pillars.day.charAt(0);

  const cols = [
    { label: "時柱(시주)", ganji: pillars.hour },
    { label: "日柱(일주)", ganji: pillars.day },
    { label: "月柱(월주)", ganji: pillars.month },
    { label: "年柱(연주)", ganji: pillars.year },
  ];

  const stemCell = (ganji: string | null, isDay: boolean): string => {
    if (!ganji) return "—";
    const gan = ganji.charAt(0);
    const hangul = ganjiToHangul(ganji).charAt(0);
    return isDay ? `**${gan}(${hangul})** ← 일간` : `${gan}(${hangul})`;
  };
  const branchCell = (ganji: string | null): string => {
    if (!ganji) return "—";
    const zhi = ganji.charAt(1);
    const hangul = ganjiToHangul(ganji).charAt(1);
    return `${zhi}(${hangul})`;
  };
  const stemGodCell = (ganji: string | null, isDay: boolean): string => {
    if (!ganji) return "—";
    if (isDay) return "일간(나)";
    return tenGodWithHangul(tenGodOf(dayStem, ganji.charAt(0)));
  };
  const branchGodCell = (ganji: string | null): string => {
    if (!ganji) return "—";
    const main = branchMainStem(ganji.charAt(1));
    if (!main) return "—";
    return tenGodWithHangul(tenGodOf(dayStem, main));
  };

  const lines = [
    `| 구분 | ${cols.map((c) => c.label).join(" | ")} |`,
    `|---|---|---|---|---|`,
    `| 천간 | ${cols.map((c, i) => stemCell(c.ganji, i === 1)).join(" | ")} |`,
    `| 지지 | ${cols.map((c) => branchCell(c.ganji)).join(" | ")} |`,
    `| 천간 십성 | ${cols.map((c, i) => stemGodCell(c.ganji, i === 1)).join(" | ")} |`,
    `| 지지 십성(본기) | ${cols.map((c) => branchGodCell(c.ganji)).join(" | ")} |`,
  ];

  if (!pillars.hour) {
    lines.push("", "> 출생 시각 미상으로 時柱는 계산하지 않았습니다 (추정하지 않습니다).");
  }

  return lines.join("\n");
}

/** 오행 분포 표 — 비율 + 텍스트 막대 */
export function buildElementsSection(saju: SajuResult): string {
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"],
    ["火", "화"],
    ["土", "토"],
    ["金", "금"],
    ["水", "수"],
  ];

  const rows = order.map(([hanja, key]) => {
    const pct = saju.elements[key];
    const blocks = Math.round(pct / 10);
    const bar = "■".repeat(blocks) + "□".repeat(Math.max(0, 10 - blocks));
    return `| ${hanja}(${wuxingToHangul(hanja)}) | ${Math.round(pct)}% | ${bar} |`;
  });

  return [`| 오행 | 비율 | 분포 |`, `|---|---|---|`, ...rows].join("\n");
}

/** 십성 분포 목록 — 본기 기준 카운트 */
export function buildTenGodsSection(saju: SajuResult): string {
  const entries = Object.entries(saju.tenGods)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return "(십성 데이터 없음)";

  return entries
    .map(([god, count]) => `- ${tenGodWithHangul(god)} × ${count}`)
    .join("\n");
}

/** 기질 지표 표 — 6축 (해석 지표, 측정치 아님) */
export function buildTraitsSection(saju: SajuResult): string {
  const entries = Object.entries(saju.traitScores);
  const header = `| ${entries.map(([k]) => k).join(" | ")} |`;
  const divider = `|${entries.map(() => "---").join("|")}|`;
  const values = `| ${entries.map(([, v]) => v).join(" | ")} |`;
  return [
    header,
    divider,
    values,
    "",
    "> 위 수치는 오행·십성 분포를 규칙표로 환산한 **해석 지표**이며, 심리 검사 같은 측정치가 아닙니다.",
  ].join("\n");
}

/** 대운 시작 나이 구간 → 학령기 라벨 */
function schoolStageLabel(startAge: number): string {
  const endAge = startAge + 9;
  const stages: Array<[number, number, string]> = [
    [0, 5, "미취학"],
    [6, 11, "초등"],
    [12, 14, "중등"],
    [15, 17, "고등"],
    [18, 29, "대학·사회 진출"],
    [30, 200, "성인"],
  ];
  const hit = stages
    .filter(([s, e]) => startAge <= e && endAge >= s)
    .map(([, , label]) => label);
  return hit.join(" → ");
}

/** 대운 타임라인 표 — 만나이 + 학령기 매핑 (학령기 중심으로 앞 5구간) */
export function buildDaeunSection(saju: SajuResult): string {
  const shown = saju.daeun.slice(0, 5);
  if (shown.length === 0) return "(대운 데이터 없음)";

  const rows = shown.map((d) => {
    const start = formatDaeunAge(d.age, d.startMonths).replace("부터", "");
    return `| ${start} ~ | ${withHangul(d.ganji)} | ${schoolStageLabel(d.age)} |`;
  });

  return [
    `| 시작(만나이) | 대운 | 해당 시기 |`,
    `|---|---|---|`,
    ...rows,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// 사실 블록 빌더 — 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/**
 * SchoolFacts → 사실 블록 텍스트 변환.
 *
 * 이 함수의 출력이 LLM에게 전달되지 않는다.
 * 코드가 학교 사실을 직접 마크다운으로 변환해 리포트에 삽입한다.
 */
export function buildFactBlock(schools: SchoolFacts): FactBlock {
  let assignedSchoolSection: string | undefined;
  let clusterSection: string | undefined;

  // ── 배정 예상 학교 ───────────────────────────────────────
  if (schools.assignedSchool) {
    const s = schools.assignedSchool;
    const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
    assignedSchoolSection = [
      `**${s.name}** (${s.type})`,
      ``,
      `| 항목 | 내용 |`,
      `|---|---|`,
      `| 라벨 | ${s.assignedLabel} |`,
      `| 통학거리 | 약 ${distKm}km |`,
      `| 주소 | ${s.address} |`,
      `| 출처 | ${schools.source} |`,
      `| 기준일 | ${schools.asOf} |`,
    ].join("\n");
  }

  // ── 반경 2km 이내 학교군 ─────────────────────────────────
  if (schools.cluster.length > 0) {
    const rows = schools.cluster
      .map((s: SchoolRecord) => {
        const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
        return `| ${s.name} | ${s.type} | 약 ${distKm}km |`;
      })
      .join("\n");

    clusterSection = [
      `### 반경 2km 이내 학교`,
      ``,
      `| 학교명 | 종류 | 통학거리 |`,
      `|---|---|---|`,
      rows,
      ``,
      `출처: ${schools.source} | 기준일: ${schools.asOf}`,
    ].join("\n");
  }

  return { assignedSchoolSection, clusterSection };
}

// ──────────────────────────────────────────────────────────────
// 리포트 조립
// ──────────────────────────────────────────────────────────────

/**
 * 데이터 블록(코드) + 관점 블록(LLM) + 사실 블록(코드)을 최종 마크다운으로 조립한다.
 *
 * 조립 순서:
 *  1. 사주 원국 표 (데이터)
 *  2. 타고난 결 — 일간 (관점)
 *  3. 오행 에너지 분포 (데이터 표 + 관점)
 *  4. 십성 구조 (데이터 목록 + 관점)
 *  5. 공부 스타일과 학습 환경 (관점 + 기질 지표 표)
 *  6. 부모님을 위한 코칭 포인트 (관점)
 *  7. 학령기 대운 흐름 (데이터 표 + 관점)
 *  8. [Premium] 학교 선택 기질 참고 (관점)
 *  9. [Premium] 예상 배정 학교·학교군 (사실)
 * 10. 기준·면책 표기 (항상)
 *
 * 관점 블록과 사실 블록 사이에 "이 학교가 정답" 같은 인과 연결은 없다.
 */
export function assembleReport(
  saju: SajuResult,
  facts: FactBlock,
  perspective: PerspectiveBlock
): string {
  const sections: string[] = [];

  // 1. 원국 (데이터)
  sections.push("## 사주 원국 (四柱原局)\n\n" + buildSajuTableSection(saju));

  // 2. 일간 (관점)
  sections.push("## 타고난 결 — 일간 이야기\n\n" + perspective.dayMasterProse);

  // 3. 오행 (데이터 + 관점)
  sections.push(
    "## 오행 에너지 분포\n\n" +
      buildElementsSection(saju) +
      "\n\n" +
      perspective.elementsProse
  );

  // 4. 십성 (데이터 + 관점)
  sections.push(
    "## 십성 구조 — 마음의 도구들\n\n" +
      buildTenGodsSection(saju) +
      "\n\n" +
      perspective.tenGodsProse
  );

  // 5. 공부 스타일 (관점 + 데이터)
  sections.push(
    "## 공부 스타일과 학습 환경\n\n" +
      perspective.studyStyleProse +
      "\n\n### 기질 지표\n\n" +
      buildTraitsSection(saju)
  );

  // 6. 부모 코칭 (관점)
  sections.push(
    "## 부모님을 위한 코칭 포인트\n\n" + perspective.parentingProse
  );

  // 7. 대운 (데이터 + 관점)
  sections.push(
    "## 학령기 대운 흐름\n\n" +
      buildDaeunSection(saju) +
      "\n\n" +
      perspective.daeunProse
  );

  // 8. [Premium] 학교 기질 참고 (관점)
  if (perspective.schoolConnectionProse) {
    sections.push(
      "## 학교 선택 기질 참고\n\n" +
        "> 아래는 사주 기질 관점에서 학교 환경 선택 시 참고할 만한 경향입니다.\n" +
        "> 특정 학교를 추천하거나 정답으로 지목하지 않습니다.\n\n" +
        perspective.schoolConnectionProse
    );
  }

  // 9. [Premium] 사실 블록 (코드 삽입)
  if (facts.assignedSchoolSection) {
    sections.push(
      "## 예상 배정 학교 (사실 정보)\n\n" +
        "> 아래 정보는 공공데이터 기반 예상 배정 결과입니다. " +
        "실제 배정은 교육청에 반드시 확인하시기 바랍니다.\n\n" +
        facts.assignedSchoolSection
    );
  }

  if (facts.clusterSection) {
    sections.push(facts.clusterSection);
  }

  // 10. 기준·면책 표기 (항상 마지막)
  sections.push("---\n\n" + TIME_STANDARD_NOTICE + "\n\n" + INTERPRETATION_NOTICE);

  return sections.join("\n\n");
}
