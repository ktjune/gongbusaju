/**
 * lib/report/template.ts
 * 사실 블록 / 데이터 블록 / 관점 블록 분리 템플릿
 *
 * [절대 규칙]
 * - 학교명·수치 등 학교 사실은 buildFactBlock()(코드)가 생성한다. LLM에게 전달되지 않는다.
 * - 배정 학교는 항상 ASSIGNED_LABEL + 출처·기준일을 붙인다.
 * - 사주 데이터 섹션(원국 표·오행·십성·기질·대운·세운)과 SVG 도식, 정적 교육
 *   콘텐츠(사전·FAQ·용어집)도 모두 코드가 생성한다. LLM은 해석 산문만 작성한다.
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
  getYearGanji,
} from "../saju";
import type { SchoolFacts, SchoolRecord } from "../schools";
import {
  HOW_TO_READ,
  SAJU_BASICS,
  STEM_DICT,
  BRANCH_DICT,
  WUXING_DICT,
  TENGOD_DICT,
  TENGOD_KEY_ALIAS,
  SUBJECT_MAP,
  SUBJECT_MAP_NOTICE,
  CAREER_MAP,
  CAREER_MAP_NOTICE,
  FAQ,
  GLOSSARY,
} from "./content";
import {
  elementsBarChart,
  wuxingCycleChart,
  traitsRadarChart,
  daeunTimelineChart,
} from "./charts";
import { deriveSchoolStage, STAGE_GUIDE, buildStageTimeline } from "./stage";

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
  /** 공부 스타일 — 학습 환경·습관·시간 운용 제안 */
  studyStyleProse: string;
  /** 학습 영역 5분야(집중·암기·이해·표현·협동) 들여다보기 */
  studyAreasProse: string;
  /** 과목 경향 — 오행 관점 매핑 표에 대한 이 아이 기준 해석 */
  subjectTendencyProse: string;
  /** 강점 분야 + 진로 방향 — 뛰어난 기질 영역과 북돋울 방향 */
  aptitudeProse: string;
  /** 직업군 경향 — 기질에 맞는 직업/진로 분야 복수 제시 (참고) */
  careerProse: string;
  /** 부모 코칭 — 보호자가 참고할 양육 포인트 */
  parentingProse: string;
  /** 현 학령 단계 × 기질 결합 해석 산문 ("지금 단계에서 기질을 살리려면") */
  stageProse: string;
  /** 초·중·고 단계별 로드맵 — 각 단계 챙길 것·접근법 */
  eduStagesProse: string;
  /** 학령기 대운 흐름 해석 산문 */
  daeunProse: string;
  /** 다가오는 세운(향후 3년) 해석 산문 */
  annualProse: string;
  /**
   * [Premium] 학교 선택 시 기질 관점에서 참고할 경향 산문.
   * 학교명·사실 절대 포함 금지.
   */
  schoolConnectionProse?: string;
};

/** 리포트 메타 — 학령 단계·세운 나이 계산 등에 사용 */
export type ReportMeta = {
  /** 출생 연도 — 학령 단계 산출·세운 표의 만나이 표기에 사용 */
  birthYear?: number;
  /** 세운 시작 연도 (기본: 현재 연도) */
  currentYear?: number;
  /**
   * 현재 재학 기관명 (보호자 입력 사실 — 코드가 표기, LLM 미전달).
   * 예: "청운초등학교", "푸른숲유치원"
   */
  currentSchoolName?: string;
};

// ──────────────────────────────────────────────────────────────
// 데이터 섹션 빌더 — 사주 계산값·사전을 표로 변환. 코드만, LLM 없음
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

/** 여덟 글자 각각의 사전 풀이 — 천간/지지 사전 기반 */
export function buildGlyphDictSection(saju: SajuResult): string {
  const { pillars } = saju;
  const entries: Array<{ pos: string; ganji: string }> = [
    { pos: "年柱(연주)", ganji: pillars.year },
    { pos: "月柱(월주)", ganji: pillars.month },
    { pos: "日柱(일주)", ganji: pillars.day },
  ];
  if (pillars.hour) entries.push({ pos: "時柱(시주)", ganji: pillars.hour });

  const parts: string[] = [];
  for (const { pos, ganji } of entries) {
    const gan = ganji.charAt(0);
    const zhi = ganji.charAt(1);
    const s = STEM_DICT[gan];
    const b = BRANCH_DICT[zhi];
    if (!s || !b) continue;
    parts.push(
      [
        `### ${pos} — ${withHangul(ganji)}`,
        ``,
        `- **${gan}(${s.hangul}) · ${s.nature}**: ${s.desc}`,
        `- **${zhi}(${b.hangul}) · ${b.animal}띠 글자 · ${b.nature}**: ${b.desc}`,
      ].join("\n")
    );
  }
  return parts.join("\n\n");
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

/** 오행별 상세 풀이 — 사전 + 이 아이의 강약 판정 */
export function buildWuxingDetailSection(saju: SajuResult): string {
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];

  const parts = order.map(([hanja, key]) => {
    const d = WUXING_DICT[hanja];
    const pct = Math.round(saju.elements[key]);
    let verdict: string;
    if (pct >= 30) verdict = `**이 아이는 강한 편(${pct}%)** — ${d.strong}`;
    else if (pct <= 10) verdict = `**이 아이는 옅은 편(${pct}%)** — ${d.weak}`;
    else verdict = `**이 아이는 보통(${pct}%)** — 치우침 없이 무난하게 작동하는 구간으로 풀이됩니다.`;
    return [
      `### ${hanja}(${d.hangul}) — ${d.keyword}`,
      ``,
      d.study,
      ``,
      verdict,
    ].join("\n");
  });

  return parts.join("\n\n");
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

/** 십성 10종 사전 — 보유 여부 표시 */
export function buildTenGodsDictSection(saju: SajuResult): string {
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(saju.tenGods)) {
    const key = TENGOD_KEY_ALIAS[k] ?? k;
    counts[key] = (counts[key] ?? 0) + v;
  }

  const rows = Object.entries(TENGOD_DICT).map(([key, d]) => {
    const count = counts[key] ?? 0;
    const own = count > 0 ? `**${count}개**` : "—";
    return `| ${key}(${d.hangul}) | ${d.group} | ${d.meaning} | ${own} |`;
  });

  const ownedDetails = Object.entries(TENGOD_DICT)
    .filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, d]) => `- **${key}(${d.hangul})**: ${d.study}`);

  return [
    `| 십성 | 분류 | 뜻 | 이 아이 |`,
    `|---|---|---|---|`,
    ...rows,
    ``,
    `#### 이 아이가 가진 십성, 공부에서는`,
    ``,
    ...ownedDetails,
  ].join("\n");
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

/** 과목 경향 매핑 표 — 전통 오행 관점 + 이 아이의 강한 오행 표시 */
export function buildSubjectMapSection(saju: SajuResult): string {
  const pctOf: Record<string, number> = {
    木: saju.elements.목, 火: saju.elements.화, 土: saju.elements.토,
    金: saju.elements.금, 水: saju.elements.수,
  };

  const rows = SUBJECT_MAP.map((m) => {
    const pct = Math.round(pctOf[m.element] ?? 0);
    const mark = pct >= 30 ? `**${pct}% ◀ 강함**` : pct <= 10 ? `${pct}% (옅음)` : `${pct}%`;
    return `| ${m.element}(${wuxingToHangul(m.element)}) | ${m.subjects} | ${mark} |`;
  });

  return [
    `| 오행 | 전통적으로 연결해 보는 학습 영역 | 이 아이 |`,
    `|---|---|---|`,
    ...rows,
    ``,
    `> ${SUBJECT_MAP_NOTICE}`,
  ].join("\n");
}

/** 직업군 경향 매핑 표 — 전통 오행 관점 + 이 아이의 강한 오행 표시 */
export function buildCareerMapSection(saju: SajuResult): string {
  const pctOf: Record<string, number> = {
    木: saju.elements.목, 火: saju.elements.화, 土: saju.elements.토,
    金: saju.elements.금, 水: saju.elements.수,
  };

  const rows = CAREER_MAP.map((m) => {
    const pct = Math.round(pctOf[m.element] ?? 0);
    const mark = pct >= 30 ? `**${pct}% ◀ 강함**` : pct <= 10 ? `${pct}% (옅음)` : `${pct}%`;
    return `| ${m.element}(${wuxingToHangul(m.element)}) | ${m.fields} | ${mark} |`;
  });

  return [
    `| 오행 | 전통적으로 연결해 보는 직업 분야 | 이 아이 |`,
    `|---|---|---|`,
    ...rows,
    ``,
    `> ${CAREER_MAP_NOTICE}`,
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

/** 세운(연운) 표 — 향후 N년 연간지 */
export function buildAnnualSection(
  fromYear: number,
  count: number,
  birthYear?: number
): string {
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = fromYear + i;
    const ganji = getYearGanji(y);
    const age = birthYear !== undefined ? `만 ${y - birthYear}세 무렵` : "—";
    rows.push(`| ${y}년 | ${withHangul(ganji)} | ${age} |`);
  }
  return [
    `| 연도 | 세운 간지 | 아이 나이 |`,
    `|---|---|---|`,
    ...rows,
    ``,
    `> 세운(歲運)은 해마다 바뀌는 그해의 기운입니다. 대운이 10년의 큰 계절이라면 세운은 그해의 날씨에 비유됩니다.`,
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
 * 데이터 블록(코드) + 정적 콘텐츠(코드) + 관점 블록(LLM) + 사실 블록(코드)을
 * 최종 마크다운으로 조립한다. SVG 도식은 인라인으로 삽입된다.
 *
 * 관점 블록과 사실 블록 사이에 "이 학교가 정답" 같은 인과 연결은 없다.
 */
export function assembleReport(
  saju: SajuResult,
  facts: FactBlock,
  perspective: PerspectiveBlock,
  meta: ReportMeta = {}
): string {
  const currentYear = meta.currentYear ?? new Date().getFullYear();

  type Section = { title: string; body: string };
  const sections: Section[] = [];

  // ── 안내·기초 (정적) ─────────────────────────────────────
  sections.push({ title: "이 리포트를 읽는 법", body: HOW_TO_READ });
  sections.push({ title: "사주팔자란 무엇인가요?", body: SAJU_BASICS });

  // ── 원국 (데이터 + 사전) ─────────────────────────────────
  sections.push({
    title: "사주 원국 (四柱原局)",
    body:
      "## 사주 원국 (四柱原局)\n\n" +
      buildSajuTableSection(saju) +
      "\n\n### 내 여덟 글자 풀이\n\n" +
      buildGlyphDictSection(saju),
  });

  // ── 일간 (관점) ──────────────────────────────────────────
  sections.push({
    title: "타고난 결 — 일간 이야기",
    body: "## 타고난 결 — 일간 이야기\n\n" + perspective.dayMasterProse,
  });

  // ── 오행 (도식 + 데이터 + 관점 + 사전) ───────────────────
  sections.push({
    title: "오행 에너지 분포",
    body:
      "## 오행 에너지 분포\n\n" +
      elementsBarChart(saju) +
      "\n\n" +
      perspective.elementsProse +
      "\n\n### 오행은 서로 돕고 누릅니다 — 상생·상극\n\n" +
      wuxingCycleChart(saju) +
      "\n\n원 크기는 이 아이 사주에서 해당 기운의 비중입니다. " +
      "초록 실선은 낳아 주는 관계(상생), 붉은 점선은 눌러 주는 관계(상극)로, " +
      "다섯 기운은 이렇게 서로 균형을 이룹니다.\n\n" +
      "### 다섯 기운 하나씩 들여다보기\n\n" +
      buildWuxingDetailSection(saju),
  });

  // ── 십성 (데이터 + 관점 + 사전) ──────────────────────────
  sections.push({
    title: "십성 구조 — 마음의 도구들",
    body:
      "## 십성 구조 — 마음의 도구들\n\n" +
      buildTenGodsSection(saju) +
      "\n\n" +
      perspective.tenGodsProse +
      "\n\n### 십성 한눈에 보기\n\n" +
      buildTenGodsDictSection(saju),
  });

  // ── 공부 스타일 (관점 + 도식 + 데이터) ───────────────────
  sections.push({
    title: "공부 스타일과 학습 환경",
    body:
      "## 공부 스타일과 학습 환경\n\n" +
      perspective.studyStyleProse +
      "\n\n### 기질 지표\n\n" +
      traitsRadarChart(saju) +
      "\n\n> 위 수치는 오행·십성 분포를 규칙표로 환산한 **해석 지표**이며, 심리 검사 같은 측정치가 아닙니다.",
  });

  // ── 학습 영역 5분야 (관점) ───────────────────────────────
  sections.push({
    title: "학습 영역별 들여다보기",
    body:
      "## 학습 영역별 들여다보기\n\n" +
      "집중·암기·이해·표현·협동 다섯 영역에서 이 아이의 기질이 어떻게 작동하는지 살펴봅니다.\n\n" +
      perspective.studyAreasProse,
  });

  // ── 과목 경향 (데이터 + 관점) ────────────────────────────
  sections.push({
    title: "과목 경향 참고",
    body:
      "## 과목 경향 참고\n\n" +
      buildSubjectMapSection(saju) +
      "\n\n" +
      perspective.subjectTendencyProse,
  });

  // ── 강점 분야 · 진로 방향 (관점) ─────────────────────────
  sections.push({
    title: "강점 분야와 진로 방향",
    body:
      "## 강점 분야와 진로 방향\n\n" +
      perspective.aptitudeProse,
  });

  // ── 직업군 경향 (데이터 + 관점) ──────────────────────────
  sections.push({
    title: "직업군 경향 참고",
    body:
      "## 직업군 경향 참고\n\n" +
      buildCareerMapSection(saju) +
      "\n\n" +
      perspective.careerProse,
  });

  // ── 부모 코칭 (관점) ─────────────────────────────────────
  sections.push({
    title: "부모님을 위한 코칭 포인트",
    body: "## 부모님을 위한 코칭 포인트\n\n" + perspective.parentingProse,
  });

  // ── 지금 우리 아이는 (학령 단계: 데이터 + 정적 가이드 + 관점) ──
  if (meta.birthYear !== undefined) {
    const stage = deriveSchoolStage(meta.birthYear, currentYear);
    const guide = STAGE_GUIDE[stage.key];
    const schoolLine = meta.currentSchoolName
      ? `\n\n> 현재 재학: **${meta.currentSchoolName}** (보호자 입력 정보)\n`
      : "";
    sections.push({
      title: `지금 우리 아이는 — ${stage.label}`,
      body:
        `## 지금 우리 아이는 — ${stage.label}\n` +
        schoolLine +
        `\n### ${guide.title}\n\n` +
        guide.body +
        `\n\n### 입학·진학 타임라인\n\n` +
        buildStageTimeline(stage, meta.birthYear, currentYear) +
        `\n\n### 이 단계에서 기질을 살리려면\n\n` +
        perspective.stageProse,
    });
  } else {
    // 출생 연도 미상 — 단계 산출 불가, 기질 결합 산문만
    sections.push({
      title: "지금 단계에서 기질을 살리려면",
      body: "## 지금 단계에서 기질을 살리려면\n\n" + perspective.stageProse,
    });
  }

  // ── 초·중·고 단계별 로드맵 (관점) ────────────────────────
  sections.push({
    title: "초·중·고 단계별 로드맵",
    body:
      "## 초·중·고 단계별 로드맵\n\n" +
      "학령 단계마다 부모의 역할과 학습 초점은 달라집니다. 이 아이 기질에 맞춘 단계별 안내입니다.\n\n" +
      perspective.eduStagesProse,
  });

  // ── 대운 (도식 + 데이터 + 관점) ──────────────────────────
  sections.push({
    title: "학령기 대운 흐름",
    body:
      "## 학령기 대운 흐름\n\n" +
      daeunTimelineChart(saju) +
      "\n\n" +
      buildDaeunSection(saju) +
      "\n\n" +
      perspective.daeunProse,
  });

  // ── 세운 (데이터 + 관점) ─────────────────────────────────
  sections.push({
    title: "다가오는 3년 — 세운",
    body:
      "## 다가오는 3년 — 세운\n\n" +
      buildAnnualSection(currentYear, 3, meta.birthYear) +
      "\n\n" +
      perspective.annualProse,
  });

  // ── [Premium] 학교 기질 참고 (관점) ──────────────────────
  if (perspective.schoolConnectionProse) {
    sections.push({
      title: "학교 선택 기질 참고",
      body:
        "## 학교 선택 기질 참고\n\n" +
        "> 아래는 사주 기질 관점에서 학교 환경 선택 시 참고할 만한 경향입니다.\n" +
        "> 특정 학교를 추천하거나 정답으로 지목하지 않습니다.\n\n" +
        perspective.schoolConnectionProse,
    });
  }

  // ── [Premium] 사실 블록 (코드 삽입) ──────────────────────
  if (facts.assignedSchoolSection) {
    sections.push({
      title: "예상 배정 학교 (사실 정보)",
      body:
        "## 예상 배정 학교 (사실 정보)\n\n" +
        "> 아래 정보는 공공데이터 기반 예상 배정 결과입니다. " +
        "실제 배정은 교육청에 반드시 확인하시기 바랍니다.\n\n" +
        facts.assignedSchoolSection +
        (facts.clusterSection ? "\n\n" + facts.clusterSection : ""),
    });
  }

  // ── 부록 (정적) ──────────────────────────────────────────
  sections.push({ title: "자주 묻는 질문", body: FAQ });
  sections.push({ title: "용어 풀이", body: GLOSSARY });

  // ── 목차 생성 ────────────────────────────────────────────
  const toc =
    "## 목차\n\n" +
    sections.map((s, i) => `${i + 1}. ${s.title}`).join("\n");

  // ── 최종 조립 ────────────────────────────────────────────
  const body = sections.map((s) => s.body).join("\n\n---\n\n");

  return [
    toc,
    body,
    "---\n\n" + TIME_STANDARD_NOTICE + "\n\n" + INTERPRETATION_NOTICE,
  ].join("\n\n---\n\n");
}
