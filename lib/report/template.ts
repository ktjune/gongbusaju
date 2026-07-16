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
  CAREER_MAP,
  MAJOR_MAP,
  FAQ,
  GLOSSARY,
} from "./content";
import {
  elementsBarChart,
  wuxingCycleChart,
  traitsRadarChart,
  daeunTimelineChart,
  buildSajuChart,
  WUXING_COLOR,
} from "./charts";
import { deriveSchoolStage, STAGE_GUIDE, buildStageTimeline } from "./stage";
import { topicParticle, objectParticle, subjectParticle } from "./josa";
import { analyzeName } from "./nameology";
import { analyzeNameHanja } from "./nameology-hanja";
import { dayMasterIllust } from "./illustrations";

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

/** 만세력 계산 기준 표기 — 모든 리포트 하단 필수 포함 */
export const TIME_STANDARD_NOTICE =
  "본 리포트의 사주 계산 기준: 일주·시주는 동경 127.5° 경도 보정(-30분), " +
  "연주·월주는 한국천문연구원(KASI) 절입시각(KST)을 따릅니다.";

/**
 * 한국 서머타임(1987·1988년) 보정이 적용된 경우 리포트 하단에 추가되는 안내.
 * 출생 시각이 서머타임(UTC+10) 기준인지 표준시(KST, UTC+9) 기준인지 보호자가 확인하도록 안내.
 */
export const DST_CORRECTION_NOTICE =
  "⚠️ **서머타임 보정 안내**: 이 아이는 한국 서머타임 적용 기간(1987년 5월 10일 ~ 10월 11일, " +
  "또는 1988년 5월 8일 ~ 10월 9일) 중 출생했습니다. " +
  "해당 기간 시계는 표준시(KST)보다 1시간 앞당겨졌으므로, 본 리포트는 입력 시각에서 " +
  "자동으로 -60분 보정을 적용했습니다. " +
  "출생증명서에 기재된 시각이 서머타임 기준인지 표준시(KST) 기준인지 확인 후, " +
  "다를 경우 실제 KST 시각으로 재신청하시기 바랍니다.";

/**
 * 해석 면책 표기 — 모든 리포트 하단 필수 포함.
 * 본문 곳곳의 "참고일 뿐" 류 반복 대신, 면책은 이 한 곳으로 모아 고지한다.
 */
export const INTERPRETATION_NOTICE =
  "**리포트를 마치며.** 본 리포트의 모든 해석 — 기질·오행·십성·공부 스타일·과목/직업/전공 경향·대운·세운·고교 유형 — 은 " +
  "사주 명리의 관점에서 본 참고 자료이며, 단정하거나 보장하는 것이 아닙니다. " +
  "기질 지표 수치는 사주 분포를 규칙표로 환산한 값으로 심리·적성 검사 결과가 아닙니다. " +
  "과목·진로·전공 적성은 결국 아이의 경험과 흥미 속에서 발견됩니다. " +
  "고교 유형 적합도(★)는 기질 관점의 참고일 뿐이며, 실제 학교 선택은 성적·통학 거리·아이 의향·입시 전형 등 현실 요소를 함께 고려해야 합니다. " +
  "학교 정보는 공공데이터 기반 예상으로 실제 배정은 교육청 확인이 필요합니다. " +
  "아이의 실제 모습과 보호자의 판단이 항상 우선합니다.";

/** 이름 한자 원획 관련 참고 — 이름 섹션에 획수를 표기한 리포트에만 하단에 모아 고지 */
export const NAME_STROKE_NOTICE =
  "이름 한자의 원획 획수는 참고 정보이며, 획수의 길흉(수리길흉)은 학설이 갈려 본 리포트에서는 판정하지 않습니다.";

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
  /** 전공·학문 계열 + 국내외 진학(유학) 방향 (참고) */
  majorProse: string;
  /** 부모 코칭 — 보호자가 참고할 양육 포인트 */
  parentingProse: string;
  /** 현 학령 단계 × 기질 결합 해석 산문 ("지금 단계에서 기질을 살리려면") */
  stageProse: string;
  /** 성장 로드맵 — 유아기·초등·중등·고등·대학/진로를 같은 비중으로 다루는 안내 */
  eduStagesProse: string;
  /** 학령기 대운 흐름 해석 산문 */
  daeunProse: string;
  /** 다가오는 세운(향후 3년) 해석 산문 */
  annualProse: string;
  /** 학교 선택 시 기질 관점에서 참고할 경향 산문. 학교명·사실 절대 포함 금지. */
  schoolConnectionProse: string;
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
  /** 아이 이름(한글, 선택) — 요약 호명용. 코드가 표기, LLM 미전달. */
  childName?: string;
  /** 아이 이름 한자(선택) — 자원오행 분석용. 코드가 표기, LLM 미전달. */
  childNameHanja?: string;
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
        `<div class="wx-item wx-pillar"><span class="wx-dot" style="background:var(--navy)"></span>${pos} — ${withHangul(ganji)}</div>`,
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
    let level: string;
    let levelDesc: string;
    if (pct >= 30) { level = `강한 편 (${pct}%)`; levelDesc = d.strong; }
    else if (pct <= 10) { level = `옅은 편 (${pct}%)`; levelDesc = d.weak; }
    else { level = `보통 (${pct}%)`; levelDesc = d.normal; }
    const color = WUXING_COLOR[hanja] ?? "#888";
    return [
      `<div class="wx-item"><span class="wx-dot" style="background:${color}"></span>${hanja}(${d.hangul}) — ${d.keyword}</div>`,
      ``,
      d.study,
      ``,
      `**이 아이에게 ${hanja}는 ${level}입니다.**`,
      ``,
      levelDesc,
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

  // 이 아이가 가진 십성만 표로 (없는 십성은 길어지기만 하므로 제외)
  const ownedEntries = Object.entries(TENGOD_DICT).filter(
    ([key]) => (counts[key] ?? 0) > 0
  );
  const rows = ownedEntries.map(([key, d]) => {
    const count = counts[key] ?? 0;
    return `| ${key}(${d.hangul}) | ${d.group} | ${d.meaning} | ${count}개 |`;
  });

  const ownedDetails = ownedEntries.map(
    ([key, d]) => `- **${key}(${d.hangul})**: ${d.study}`
  );

  // 미보유 십성은 이름만 한 줄로 압축 안내
  const absent = Object.entries(TENGOD_DICT)
    .filter(([key]) => (counts[key] ?? 0) === 0)
    .map(([key, d]) => `${key}(${d.hangul})`);

  const out: string[] = [
    `| 십성 | 분류 | 뜻 | 이 아이 |`,
    `|---|---|---|---|`,
    ...rows,
  ];
  if (absent.length > 0) {
    out.push(
      ``,
      `<p class="datanote">이 아이 사주에서 두드러지지 않는 십성: ${absent.join(", ")} — 없다고 부족한 것이 아니라, 위에 나타난 기운이 더 선명하다는 뜻입니다.</p>`
    );
  }
  out.push(``, `#### 이 아이가 가진 십성, 공부에서는`, ``, ...ownedDetails);

  return out.join("\n");
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

/** 오행 매핑 표 공통 렌더러 — 색 칩 + '강한 행'(≥30%) 골드 하이라이트 HTML 표 */
function mapTableHtml(
  headers: [string, string, string, string],
  rows: Array<{ element: string; mid: [string, string]; pct: number }>
): string {
  const th = headers.map((h) => `<th>${h}</th>`).join("");
  const body = rows
    .map((r) => {
      const color = WUXING_COLOR[r.element] ?? "#888";
      const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>`;
      const mark =
        r.pct >= 30
          ? `<strong>${r.pct}% ◀ 강함</strong>`
          : r.pct <= 10
            ? `${r.pct}% (옅음)`
            : `${r.pct}%`;
      const cells = [
        `${dot}${r.element}(${wuxingToHangul(r.element)})`,
        r.mid[0],
        r.mid[1],
        mark,
      ];
      return `<tr${r.pct >= 30 ? ' class="hl"' : ""}>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table class="maptable"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

function pctByElement(saju: SajuResult): Record<string, number> {
  return {
    木: saju.elements.목, 火: saju.elements.화, 土: saju.elements.토,
    金: saju.elements.금, 水: saju.elements.수,
  };
}

/** 과목 경향 매핑 표 — 전통 오행 관점 + 연결 이유 + 이 아이의 강한 오행 표시 */
export function buildSubjectMapSection(saju: SajuResult): string {
  const pctOf = pctByElement(saju);
  return mapTableHtml(
    ["오행", "전통적으로 연결해 보는 학습 영역", "왜 이렇게 연결되나요?", "이 아이"],
    SUBJECT_MAP.map((m) => ({
      element: m.element,
      mid: [m.subjects, m.why],
      pct: Math.round(pctOf[m.element] ?? 0),
    }))
  );
}

/** 직업군 경향 매핑 표 — 전통 오행 관점 + 연결 이유 + 이 아이의 강한 오행 표시 */
export function buildCareerMapSection(saju: SajuResult): string {
  const pctOf = pctByElement(saju);
  return mapTableHtml(
    ["오행", "전통적으로 연결해 보는 직업 분야", "연결 기운", "이 아이"],
    CAREER_MAP.map((m) => ({
      element: m.element,
      mid: [m.fields, m.trait],
      pct: Math.round(pctOf[m.element] ?? 0),
    }))
  );
}

/** 전공·학문 계열 매핑 표 — 전통 오행 관점 + 연결 이유 + 이 아이의 강한 오행 표시 */
export function buildMajorMapSection(saju: SajuResult): string {
  const pctOf = pctByElement(saju);
  const table = mapTableHtml(
    ["오행", "전통적으로 연결해 보는 전공·학문 계열", "연결 기운", "이 아이"],
    MAJOR_MAP.map((m) => ({
      element: m.element,
      mid: [m.majors, m.trait],
      pct: Math.round(pctOf[m.element] ?? 0),
    }))
  );
  return `${table}\n\n> 관심 전공이 정해지면 그 분야가 강한 국내외 대학을 직접 살펴보시기를 권합니다.`;
}

/**
 * 진로·전공 통합 매핑 표 — 직업 분야와 전공 계열을 한 표로 묶는다.
 * (직업/전공 표가 "오행·연결기운·이 아이" 열까지 똑같아 두 번 보이던 중복 제거.
 *  '연결 기운'은 앞선 오행 섹션에서 이미 설명하므로 열에서 뺐다.)
 */
export function buildCareerMajorMapSection(saju: SajuResult): string {
  const pctOf = pctByElement(saju);
  const majorsByElement = new Map(MAJOR_MAP.map((m) => [m.element, m.majors]));
  const table = mapTableHtml(
    ["오행", "연결해 보는 직업 분야", "연결해 보는 전공·학문 계열", "이 아이"],
    CAREER_MAP.map((m) => ({
      element: m.element,
      mid: [m.fields, majorsByElement.get(m.element) ?? ""],
      pct: Math.round(pctOf[m.element] ?? 0),
    }))
  );
  return `${table}\n\n> 관심 전공이 정해지면 그 분야가 강한 국내외 대학을 직접 살펴보시기를 권합니다.`;
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
    `<p class="datanote">세운(歲運)은 해마다 바뀌는 그해의 기운입니다. 대운이 10년의 큰 계절이라면 세운은 그해의 날씨에 비유됩니다.</p>`,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// 학교 유형 기질 점수 — 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/** 학교 유형별 기질 적합도 */
export type SchoolTypeScore = {
  type: string;        // DB의 highSchoolType 값과 매칭
  label: string;       // 표시용 이름
  stars: number;       // 0-3 (★ 개수)
  reason: string;      // 코드가 계산한 짧은 이유 (1줄, ~30자)
};

/**
 * 오행·십성 분포에서 학교 유형별 기질 적합도를 계산한다.
 * 점수는 사주 관점의 참고 지표이며, 현실적 학교 선택 기준이 아니다.
 */
export function deriveSchoolTypeScores(saju: SajuResult): SchoolTypeScore[] {
  const e = saju.elements;  // { 목, 화, 토, 금, 수 } 각 %
  const tg = saju.tenGods;  // { 비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인 }

  // 편의 함수
  const has = (key: string) => (tg[key] ?? 0) > 0;
  const sum = (...keys: string[]) => keys.reduce((acc, k) => acc + (tg[k] ?? 0), 0);

  // 자율고: 자기주도·탐구·창의 기질 → 水·木 강, 편인·식신
  let 자율 = 0;
  if (e.수 >= 30) 자율 += 2;
  else if (e.수 >= 20) 자율 += 1;
  if (e.목 >= 30) 자율 += 1;
  if (has("편인")) 자율 += 1;
  if (has("식신")) 자율 += 1;

  // 특수목적고: 특화 심화·경쟁·도전 기질 → 金·火 강, 편관·상관·정인
  let 특목 = 0;
  if (e.금 >= 30) 특목 += 2;
  else if (e.금 >= 20) 특목 += 1;
  if (e.화 >= 30) 특목 += 1;  // 예술고 계통
  if (has("편관")) 특목 += 2;
  if (has("상관")) 특목 += 1;
  if (sum("정인", "편인") >= 2) 특목 += 1;

  // 일반고: 균형·안정·체계 기질 → 土 강, 정관·정인
  let 일반 = 1;  // 기본 1점 (어디든 무난)
  if (e.토 >= 25) 일반 += 2;
  else if (e.토 >= 15) 일반 += 1;
  if (has("정관")) 일반 += 1;
  if (has("정인")) 일반 += 1;

  // 특성화고: 실용·기술·경영 기질 → 土·金 실용형, 재성·식신
  let 특성화 = 0;
  if (e.토 >= 30) 특성화 += 1;
  if (e.금 >= 25) 특성화 += 1;
  if (sum("편재", "정재") >= 2) 특성화 += 2;
  else if (sum("편재", "정재") >= 1) 특성화 += 1;
  if (has("식신") && e.토 >= 20) 특성화 += 1;

  // 3점 상한
  const cap = (n: number) => Math.min(3, n);

  const scores: SchoolTypeScore[] = [
    {
      type: "자율고등학교",
      label: "자율고(자사고·자공고)",
      stars: cap(자율),
      reason: 자율 >= 2 ? "탐구·자기주도 기질, 자유로운 환경에서 강점" : 자율 === 1 ? "부분적으로 잘 맞는 환경" : "경직된 환경보다는 맞지만 두드러지지 않음",
    },
    {
      type: "특수목적고등학교",
      label: "특수목적고(과학고·외고·예술고 등)",
      stars: cap(특목),
      reason: 특목 >= 2 ? "특화 분야 심화·경쟁 환경에서 강점 발휘 가능" : 특목 === 1 ? "관심 분야 특화 학교 참고 가능" : "일반 환경이 더 맞는 기질",
    },
    {
      type: "일반고등학교",
      label: "일반고등학교",
      stars: cap(일반),
      reason: 일반 >= 3 ? "균형·체계 환경에 잘 맞는 기질" : 일반 >= 2 ? "안정적 선택, 무난한 환경" : "다양한 가능성 열어두기 좋은 선택",
    },
    {
      type: "특성화고등학교",
      label: "특성화고(직업·기술계)",
      stars: cap(특성화),
      reason: 특성화 >= 2 ? "실용·기술 계통에 강한 기질 경향" : 특성화 === 1 ? "실용 분야 관심 있다면 참고" : "이론·탐구형 기질이 강한 편",
    },
  ];

  // 별점 내림차순. 동점이면 보수적(무난한) 유형을 앞에 둔다:
  // 일반고 > 자율고 > 특수목적고 > 특성화고. (예: 土 강한 아이가 특목·일반 동점일 때 일반고가 1순위)
  const tiePriority: Record<string, number> = {
    일반고등학교: 0,
    자율고등학교: 1,
    특수목적고등학교: 2,
    특성화고등학교: 3,
  };
  return scores.sort(
    (a, b) => b.stars - a.stars || tiePriority[a.type] - tiePriority[b.type]
  );
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
export function buildFactBlock(schools: SchoolFacts, saju?: SajuResult): FactBlock {
  let assignedSchoolSection: string | undefined;
  let clusterSection: string | undefined;

  // ── 배정 예상 학교 ───────────────────────────────────────
  if (schools.assignedSchool) {
    const s = schools.assignedSchool;
    const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
    const typeRows =
      s.type === "고등학교" && s.highSchoolType
        ? [`| 고교유형 | ${s.highSchoolType} |`]
        : [];
    assignedSchoolSection = [
      `**${s.name}** (${s.type})`,
      ``,
      `| 항목 | 내용 |`,
      `|---|---|`,
      `| 라벨 | ${s.assignedLabel} |`,
      ...typeRows,
      `| 통학거리 | 약 ${distKm}km |`,
      `| 주소 | ${s.address} |`,
      `| 출처 | ${schools.source} |`,
      `| 기준일 | ${schools.asOf} |`,
    ].join("\n");
  }

  // ── 반경 2km 이내 학교군 — 고교 유형별 분류 + 기질 참고 ────
  if (schools.cluster.length > 0) {
    const parts: string[] = [];

    // 1. 사주 기반 학교 유형 점수 (saju 있을 때만)
    let typeScores: SchoolTypeScore[] | null = null;
    if (saju) {
      typeScores = deriveSchoolTypeScores(saju);
      const starsStr = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
      const scoreRows = typeScores.map(
        (s) => `| ${s.label} | ${starsStr(s.stars)} | ${s.reason} |`
      );
      parts.push(
        "### 기질로 본 고교 유형 참고",
        "",
        "| 고교 유형 | 기질 적합도 | 참고 |",
        "|---|---|---|",
        ...scoreRows
      );
    }

    // 2. 초등·중학교 (배정 기반, 유형 분류 불필요)
    const elementaryMiddle = schools.cluster.filter(
      (s: SchoolRecord) => s.type !== "고등학교"
    );
    if (elementaryMiddle.length > 0) {
      const rows = elementaryMiddle.map((s: SchoolRecord) => {
        const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
        return `| ${s.name} | ${s.type} | 약 ${distKm}km |`;
      });
      parts.push(
        "",
        "### 인근 초·중학교",
        "",
        "| 학교명 | 종류 | 통학거리 |",
        "|---|---|---|",
        ...rows
      );
    }

    // 3. 고등학교 — 유형별 그룹화, 기질 점수 높은 유형 먼저
    const highSchools = schools.cluster.filter(
      (s: SchoolRecord) => s.type === "고등학교"
    );
    if (highSchools.length > 0) {
      // 유형 순서: 기질 점수 순 (typeScores) 또는 기본 순
      const typeOrder = typeScores
        ? typeScores.map((s) => s.type)
        : ["자율고등학교", "특수목적고등학교", "일반고등학교", "특성화고등학교"];
      const typeOrderMap = new Map(typeOrder.map((t, i) => [t, i]));

      // 유형별 그룹
      const grouped = new Map<string, SchoolRecord[]>();
      for (const s of highSchools) {
        const key = s.highSchoolType ?? "기타";
        const arr = grouped.get(key) ?? [];
        arr.push(s);
        grouped.set(key, arr);
      }

      // 유형 정렬: 기질 점수 높은 순
      const sortedTypes = [...grouped.keys()].sort(
        (a, b) => (typeOrderMap.get(a) ?? 99) - (typeOrderMap.get(b) ?? 99)
      );

      parts.push("", "### 인근 고등학교 (유형별)");

      for (const type of sortedTypes) {
        const schools_ = grouped.get(type)!;
        const score = typeScores?.find((s) => s.type === type);
        const starsStr = score ? " " + "★".repeat(score.stars) + "☆".repeat(3 - score.stars) : "";
        parts.push(
          "",
          `**▶ ${type}${starsStr}**`,
          "",
          "| 학교명 | 통학거리 |",
          "|---|---|",
          ...schools_.map((s: SchoolRecord) => {
            const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
            return `| ${s.name} | 약 ${distKm}km |`;
          })
        );
      }
    }

    parts.push(
      "",
      `출처: ${schools.source} | 기준일: ${schools.asOf}`
    );

    clusterSection = parts.join("\n");
  }

  return { assignedSchoolSection, clusterSection };
}

// ──────────────────────────────────────────────────────────────
// 한 장 요약 — 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/**
 * 일간별 물상(物象) 형상 — 전통 명리 형상론의 상징 이미지.
 * "봉황이 보석을 물고…" 류의, 좋은 기운을 담은 비유 문구. 단정·보장이 아니라 상징적 풀이다.
 */
const DAY_MASTER_IMAGERY: Record<string, { form: string; reading: string }> = {
  甲: { form: "청룡이 구름을 뚫고 하늘로 오르는 형상(청룡등천靑龍登天)", reading: "곧게 뻗어 크게 자라나는 큰 나무의 기상으로, 한번 뜻을 세우면 위로 뻗어 나가는 추진력을 품고 있습니다" },
  乙: { form: "봄바람에 난초가 은은히 향을 퍼뜨리는 형상", reading: "부드럽게 굽이쳐 끝내 뜻을 이루는 화초의 결로, 환경에 맞춰 유연하게 길을 찾아내는 영리함을 품고 있습니다" },
  丙: { form: "봉황이 아침 해를 향해 날개를 활짝 펴는 형상(단봉조양丹鳳朝陽)", reading: "온 세상을 밝히는 한낮 태양의 기상으로, 그 자리에 있으면 주위가 환해지는 밝고 따뜻한 기운을 품고 있습니다" },
  丁: { form: "어둠 속 별빛이 밤길을 밝히는 형상", reading: "은은히 오래 타며 주위를 비추는 등불의 결로, 속 깊은 곳에서 조용히 빛나는 총명함을 품고 있습니다" },
  戊: { form: "큰 산이 옥을 품고 우뚝 선 형상(중산장옥重山藏玉)", reading: "흔들림 없이 만물을 받치는 태산의 기상으로, 듬직하게 중심을 잡아 주위가 기대고 싶어 하는 신뢰를 품고 있습니다" },
  己: { form: "기름진 옥토가 씨앗을 품어 길러 내는 형상", reading: "조용히 감싸 열매 맺게 하는 밭의 결로, 드러내지 않고 안에서 키워 내는 깊은 포용력을 품고 있습니다" },
  庚: { form: "무쇠가 불을 만나 명검으로 벼려지는 형상", reading: "단련될수록 빛나는 강인한 쇠의 기상으로, 옳고 그름이 분명하고 결단이 곧은 기운을 품고 있습니다" },
  辛: { form: "봉황이 보석을 물고 오동나무에 깃드는 형상(봉함주鳳含珠)", reading: "맑고 예리하게 빛나는 보석의 결로, 섬세하게 다듬어진 총명함과 은은한 품격을 품고 있습니다" },
  壬: { form: "온갖 물길이 큰 바다로 모여드는 형상(백천귀해百川歸海)", reading: "무엇이든 담아 깊고 넓게 흐르는 강물의 기상으로, 크게 아우르는 포용력과 깊은 사고력을 품고 있습니다" },
  癸: { form: "단비가 마른 대지를 적셔 새싹을 틔우는 형상", reading: "스며들어 생명을 기르는 이슬비의 결로, 조용히 만물을 적시는 세심함과 풍부한 상상력을 품고 있습니다" },
};

/** 가장 강한 오행별 성정 수식 — 형상 뒤에 붙는 보강 문구 (오상五常과 연결) */
const STRONG_ELEMENT_FLOURISH: Record<string, string> = {
  木: "여기에 뿌리 깊은 나무의 기운이 더해져, 배움이 곧게 자라며 어짊(仁)의 성정이 도탑습니다.",
  火: "여기에 밝게 타오르는 불의 기운이 더해져, 총명함이 예(禮)로 드러나며 자리를 환하게 밝힙니다.",
  土: "여기에 두터운 대지의 기운이 더해져, 믿음(信)이 굳고 한번 뿌리내리면 끝까지 지켜 냅니다.",
  金: "여기에 잘 벼린 쇠의 기운이 더해져, 옳고 그름을 가르는 의(義)와 명민한 분별이 도드라집니다.",
  水: "여기에 깊고 맑은 물의 기운이 더해져, 사려 깊은 지혜(智)가 흐르며 총명함이 안으로 그윽합니다.",
};

/** 우세 십성 그룹(접두어)별 '공부의 축' 문구 */
const TENGOD_GROUP_STUDY_AXIS: Record<string, string> = {
  비겁: "스스로 주인이 되어 또래와 겨루며 나아가는 **주체의 힘**이 공부의 축을 이룹니다.",
  식상: "배운 것을 자기 방식으로 풀어내고 표현하는 **창출의 힘**이 공부의 축을 이룹니다.",
  재성: "쓸모와 목표가 또렷할 때 힘을 내는 **실리의 힘**이 공부의 축을 이룹니다.",
  관성: "규칙과 목표 안에서 자신을 단련하는 **절제의 힘**이 공부의 축을 이룹니다.",
  인성: "듣고 읽어 깊이 받아들이는 **수용과 배움의 힘**이 공부의 축을 이룹니다.",
};

/**
 * 리포트 맨 앞에 들어가는 "한 장 요약" 섹션.
 * 사주 계산값(일간·오행·십성·기질 지표·고교 유형 점수)에서 핵심을 추려,
 * ① 형상론 상징 문구 → ② 풀어 쓰는 개관 → ③ 빠른 참고 순으로 보여 준다.
 * 부모가 긴 본문을 다 읽기 전에 먼저 그림을 잡을 수 있도록 한다. LLM 미관여(코드 생성).
 */
export function buildSummarySection(
  saju: SajuResult,
  childName?: string,
  childNameHanja?: string
): string {
  const name = childName?.trim() || undefined;
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];
  const withPct = order.map(([hanja, key]) => ({ hanja, pct: saju.elements[key] }));
  const strong = [...withPct].sort((a, b) => b.pct - a.pct)[0];
  const weak = [...withPct].sort((a, b) => a.pct - b.pct)[0];
  const strongD = WUXING_DICT[strong.hanja];
  const weakD = WUXING_DICT[weak.hanja];

  const dayStem = saju.pillars.day.charAt(0);
  const dayKr = ganjiToHangul(saju.pillars.day).charAt(0);
  const sd = STEM_DICT[dayStem];
  const imagery = DAY_MASTER_IMAGERY[dayStem];

  // 우세 십성 그룹 — group 전체 문자열("인성(나를 키우는 기운)") 기준 합산
  const groupCounts: Record<string, number> = {};
  for (const [k, v] of Object.entries(saju.tenGods)) {
    if (v <= 0) continue;
    const key = TENGOD_KEY_ALIAS[k] ?? k;
    const g = TENGOD_DICT[key]?.group;
    if (!g) continue;
    groupCounts[g] = (groupCounts[g] ?? 0) + v;
  }
  const domGroupFull = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const domGroupPrefix = domGroupFull?.split("(")[0];

  const topTraits = Object.entries(saju.traitScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const topType = deriveSchoolTypeScores(saju)[0];
  const stars = "★".repeat(topType.stars) + "☆".repeat(3 - topType.stars);

  // ── ① 형상(物象) 블록 ──────────────────────────────────
  const escName = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const imageryLabel = name
    ? `한마디로, ${escName(name)}${topicParticle(name)} 이런 결의 아이예요`
    : "한마디로, 이런 결의 아이예요";
  const illust = dayMasterIllust(dayStem);
  const imageryBlock = imagery
    ? [
        `<div class="imagery-card">`,
        illust ? `<div class="imagery-illust">${illust}</div>` : "",
        `<div class="imagery-label">${imageryLabel}</div>`,
        `<div class="imagery-form">${imagery.form}</div>`,
        `<div class="imagery-reading">${imagery.reading}. ${STRONG_ELEMENT_FLOURISH[strong.hanja] ?? ""}</div>`,
        `</div>`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  // ── ② 풀어 쓰는 개관 (서술형) ─────────────────────────
  const narrative: string[] = [];
  const whoseCenter = name
    ? `${name}의 중심 글자, 곧 사주에서 ${name}${objectParticle(name)} 나타내는`
    : `이 아이의 중심 글자, 곧 사주에서 아이 자신을 나타내는`;
  narrative.push(
    `${whoseCenter} **일간(日干)은 ${dayStem}(${dayKr})**입니다. ` +
      `${sd ? sd.desc : ""}`
  );
  narrative.push(
    `타고난 다섯 기운 가운데 **${strong.hanja}(${strongD.hangul}) 기운이 ${Math.round(strong.pct)}%로 가장 도드라집니다.** ` +
      `${strongD.keyword}의 결로, ${strongD.study} 이 기운이 이 아이 공부의 바탕색이 되어, ` +
      `무엇을 어떻게 배울 때 편안하고 오래 몰입하는지를 결정짓습니다.`
  );
  narrative.push(
    `반대로 **${weak.hanja}(${weakD.hangul}) 기운은 ${Math.round(weak.pct)}%로 옅은 편**입니다. ` +
      `${weakD.keyword}의 힘은 아직 자라는 중인 여백으로, 부족함이 아니라 앞으로 채워 갈 여지로 보아 주시면 됩니다. ` +
      `본문의 오행 풀이에서 이 기운을 자연스럽게 북돋우는 구체적인 놀이·활동을 함께 담았습니다.`
  );
  if (domGroupFull && domGroupPrefix && TENGOD_GROUP_STUDY_AXIS[domGroupPrefix]) {
    narrative.push(
      `십성(十神), 곧 여덟 글자가 서로 맺는 관계를 보면 **${domGroupFull}**이 두드러집니다. ` +
        `${TENGOD_GROUP_STUDY_AXIS[domGroupPrefix]} ` +
        `같은 내용을 배우더라도 이 축을 살려 주는 방식일 때 아이가 훨씬 힘을 냅니다.`
  );
  }
  narrative.push(
    `기질 지표에서는 **${topTraits}**가 특히 돋보입니다. ` +
      `이 결들이 실제 공부와 생활 장면에서 어떻게 드러나는지, 그리고 부모님이 어떻게 북돋아 주면 좋은지를 ` +
      `이어지는 본문에서 오행·십성·공부 스타일·진로·단계별 안내로 하나씩 풀어 갑니다. ` +
      `**아래 표는 그 긴 이야기를 한눈에 보기 위한 이정표입니다.**`
  );

  // ── ③ 빠른 참고 — 2열 스펙 그리드 ──────────────────────
  // 이름 어울림 요약 (이름 있을 때만) — 자세한 풀이는 뒤 '이름과 사주의 어울림' 섹션.
  // 한자 있으면 자원오행(성명학 본류)을, 없으면 발음오행을 티저로 쓴다.
  let nameSpec: [string, string] | null = null;
  const hjName = childNameHanja?.trim();
  if (name) {
    const na = (hjName && analyzeNameHanja(hjName, saju)) || analyzeName(name, saju);
    if (na) {
      const wH = WUXING_DICT[na.weakEl]?.hangul ?? na.weakEl;
      const sH = WUXING_DICT[na.strongEl]?.hangul ?? na.strongEl;
      const v =
        na.complementType === "보완"
          ? `부족한 ${na.weakEl}(${wH}) 기운을 채워 줌`
          : na.complementType === "강화"
            ? `강한 ${na.strongEl}(${sH}) 기운을 북돋움`
            : "사주와 무난히 조화";
      nameSpec = [`${name} · 이름 어울림`, v];
    }
  }
  const specs: Array<[string, string]> = [
    ["타고난 결", `일간 ${dayStem}(${dayKr})${sd ? ` · ${sd.nature}` : ""}`],
    ...(nameSpec ? [nameSpec] : []),
    ["가장 강한 기운", `${strong.hanja}(${strongD.hangul}) ${Math.round(strong.pct)}% · ${strongD.keyword}`],
    ["보완하면 좋을 기운", `${weak.hanja}(${weakD.hangul}) ${Math.round(weak.pct)}%`],
    ["돋보이는 기질 지표", topTraits],
    ["고교 유형 참고 (1순위)", `${topType.label} ${stars}`],
  ];
  const bullets =
    "### 빠르게 훑어보기\n\n" +
    `<div class="spec-grid">` +
    specs
      .map(
        ([l, v]) =>
          `<div class="spec-item"><div class="spec-label">${l}</div><div class="spec-value">${v}</div></div>`
      )
      .join("") +
    `</div>`;

  // 블록 단위로 조립 — 빈 블록(형상 미정의)만 제외하고 문단 간격(\n\n)을 유지한다.
  return [
    "## 우리 아이 한 장 요약",
    imageryBlock,
    narrative.join("\n\n"),
    bullets,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 챕터 구분자 밴드 — 배경 일러스트 + 챕터 번호·제목·부제.
 * 잡지식 장(章) 구분으로 진도감을 준다. 배경 이미지는 흐리게 블렌딩되고
 * 텍스트가 그 위에 올라간다. (img 비우면 텍스트만)
 */
function chapterDivider(num: number, title: string, sub: string, img: string): string {
  const roman = String(num).padStart(2, "0");
  return [
    `<div class="chapter-divider">`,
    `<div class="chapter-text">`,
    `<div class="chapter-num">CHAPTER ${roman}</div>`,
    `<div class="chapter-title">${title}</div>`,
    `<div class="chapter-sub">${sub}</div>`,
    `</div>`,
    img ? `<img class="chapter-img" src="/illust/${img}.png" alt="" aria-hidden="true" />` : "",
    `</div>`,
  ]
    .filter(Boolean)
    .join("");
}

// ──────────────────────────────────────────────────────────────
// 이름과 사주 (성명학 라이트 — 발음오행) — 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/** 오행별 '기운을 북돋우는 법' — 아이 일상에서 실천 가능한 구체 활동·색 (성명학 보완용) */
const WUXING_SUPPLEMENT: Record<string, { keyword: string; how: string }> = {
  木: {
    keyword: "성장·시작",
    how: "자연 나들이·화분 기르기·나무 블록·그림 그리기처럼 새로 시작하고 자라나는 활동이 이 기운을 북돋웁니다. 초록·청색 소품이나 옷도 은근한 도움이 됩니다.",
  },
  火: {
    keyword: "표현·발산",
    how: "발표·노래·율동·역할놀이·바깥에서 뛰놀기처럼 아는 것을 밖으로 꺼내고 발산하는 활동이 이 기운을 채워 줍니다. 빨강·주황 포인트 색이 활기를 더해 줍니다.",
  },
  土: {
    keyword: "안정·끈기",
    how: "규칙적인 하루 루틴·정리 습관·흙/모래 놀이·요리 돕기처럼 차곡차곡 쌓는 활동이 이 기운을 길러 줍니다. 노랑·황토색 소품이 안정감을 더합니다.",
  },
  金: {
    keyword: "정리·분별",
    how: "정리정돈·퍼즐·블록 분류·악기 연주·규칙 있는 보드게임처럼 가르고 정돈하는 활동이 이 기운을 세워 줍니다. 흰색·은은한 금속색 소품이 잘 어울립니다.",
  },
  水: {
    keyword: "사고·유연",
    how: "책 읽어 주기·물놀이·조용한 사색 시간·자기 생각 말해 보기처럼 깊이 생각하고 흐르는 활동이 이 기운을 채워 줍니다. 파랑·남색 소품이 차분함을 더합니다.",
  },
};

/**
 * 이름(한글)의 발음오행과 사주의 어울림 섹션.
 * 이름이 없거나 한글 음절이 없으면 빈 문자열(섹션 생략).
 * 절대 "흉명/개명" 판정 없이 긍정·참고 프레임으로만 서술한다. LLM 미관여.
 */
export function buildNameSajuSection(
  saju: SajuResult,
  name?: string,
  nameHanja?: string
): string {
  const nm = name?.trim();
  if (!nm) return "";
  const a = analyzeName(nm, saju);
  if (!a) return "";

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const nmE = esc(nm);
  const hangulOf = (el: string) => WUXING_DICT[el]?.hangul ?? el;
  const weakH = hangulOf(a.weakEl);
  const strongH = hangulOf(a.strongEl);

  // 글자별 오행 칩
  const chips = a.chars
    .map((c) => {
      if (!c.element) {
        return `<span class="name-chip name-chip-x">${esc(c.syllable)}</span>`;
      }
      const color = WUXING_COLOR[c.element] ?? "#888";
      return `<span class="name-chip" style="border-color:${color}"><b>${esc(c.syllable)}</b><span style="color:${color}">${c.element}·${hangulOf(c.element)}</span></span>`;
    })
    .join("");

  // ── 사주 보완 관계 ──
  let comp: string;
  if (a.complementType === "보완") {
    comp =
      `**${nmE}, 이 이름은 사주에 옅은 ${a.weakEl}(${weakH}) 기운을 품고 있습니다.** ` +
      `타고난 사주에서 부족한 부분을 이름이 은근히 채워 주는 결이에요. ` +
      `성명학에서 가장 좋게 보는 '사주를 보완하는 이름'에 해당합니다.`;
  } else if (a.complementType === "강화") {
    comp =
      `**${nmE}, 이 이름은 사주에서 이미 강한 ${a.strongEl}(${strongH}) 기운을 한 번 더 북돋습니다.** ` +
      `타고난 강점을 밀어 주는 이름이에요. 사주에서 옅은 ${a.weakEl}(${weakH}) 기운은 ` +
      `이름보다 생활 속 활동(앞서 오행 풀이에서 제안한 것들)으로 채워 주시면 균형이 더 좋아집니다.`;
  } else {
    comp =
      `**${nmE}, 이 이름의 기운은 사주와 큰 충돌 없이 무난하게 어우러집니다.** ` +
      `특정 기운을 크게 더하거나 빼지 않고 조화롭게 놓이는 결이에요.`;
  }

  // ── 이름 글자 간 흐름 ──
  let flow = "";
  if (a.flow === "상생") {
    flow = `이름 글자들의 기운이 서로 살려 주는(상생) 흐름이라, 부르는 결이 부드럽게 이어집니다.`;
  } else if (a.flow === "비화") {
    flow = `이름 글자들이 같은 기운으로 모여, 결이 한결같고 뚜렷합니다.`;
  } else if (a.flow === "상극") {
    flow =
      `이름 글자 사이에는 기운의 결이 서로 다른(상극) 구간이 있습니다. ` +
      `성명학에선 상생 흐름을 더 좋게 보기도 하지만, 이는 여러 관점 중 하나일 뿐이며 ` +
      `서로 다른 기운이 만나 오히려 다채로운 결을 담는다고도 볼 수 있습니다.`;
  }

  // ── 부족한 기운 → 보완법 (핵심) ──
  const sup = WUXING_SUPPLEMENT[a.weakEl];
  const supColor = WUXING_COLOR[a.weakEl] ?? "#888";
  let supIntro: string;
  if (a.complementType === "보완") {
    supIntro =
      `사주에서 가장 옅은 기운은 **${a.weakEl}(${weakH}) — ${sup?.keyword ?? ""}**입니다. ` +
      `반가운 점은, 이름 '${nmE}'${subjectParticle(nm)} 바로 이 ${a.weakEl}(${weakH}) 기운을 품고 있어 **부족한 자리를 이름이 은근히 채워 준다**는 것이에요. ` +
      `여기에 아래 활동을 곁들이면 그 기운이 한층 더 살아납니다.`;
  } else {
    supIntro =
      `사주에서 가장 옅은 기운은 **${a.weakEl}(${weakH}) — ${sup?.keyword ?? ""}**입니다. ` +
      `이름 '${nmE}'는 이 ${a.weakEl}(${weakH}) 기운을 직접 담고 있진 않아요. ` +
      `그러니 이 기운은 **이름 밖, 생활 속에서 채워 주면** 균형이 좋아집니다. 이렇게요.`;
  }
  const supCard = sup
    ? `<div class="name-supplement" style="border-left-color:${supColor}">` +
      `<div class="ns-head" style="color:${supColor}">${a.weakEl}(${weakH}) 기운을 북돋우는 법</div>` +
      `<div class="ns-body">${sup.how}</div>` +
      `</div>`
    : "";

  // ── 한자 자원오행 (한자가 있을 때만) ──
  const hanjaBlock: string[] = [];
  const hj = nameHanja?.trim();
  if (hj) {
    const ha = analyzeNameHanja(hj, saju);
    if (ha && ha.elements.length > 0) {
      const hchips = ha.chars
        .map((c) => {
          if (!c.element) {
            return `<span class="name-chip name-chip-x">${esc(c.char)}</span>`;
          }
          const color = WUXING_COLOR[c.element] ?? "#888";
          const stroke = c.strokes ? `<span class="chip-stroke">${c.strokes}획</span>` : "";
          return `<span class="name-chip" style="border-color:${color}"><b>${esc(c.char)}</b><span style="color:${color}">${c.element}·${hangulOf(c.element)}</span>${stroke}</span>`;
        })
        .join("");
      let hcomp: string;
      if (ha.complementType === "보완") {
        hcomp =
          `한자에 담긴 오행(자원오행)으로 보면, '${nmE}'는 사주에 옅은 **${ha.weakEl}(${hangulOf(ha.weakEl)})** 기운을 품고 있어 ` +
          `부족한 자리를 채워 주는 이름입니다. 전통 작명에서 가장 좋게 보는 '사주를 보완하는 이름'에 해당해요.`;
      } else if (ha.complementType === "강화") {
        hcomp =
          `한자에 담긴 오행(자원오행)으로 보면, '${nmE}'는 사주에서 이미 강한 **${ha.strongEl}(${hangulOf(ha.strongEl)})** 기운을 ` +
          `한 번 더 북돋습니다. 타고난 강점을 밀어 주는 이름이에요.`;
      } else {
        hcomp = `한자에 담긴 오행(자원오행)으로 보면, '${nmE}'의 기운은 사주와 큰 충돌 없이 무난하게 어우러집니다.`;
      }
      hanjaBlock.push(
        "### 이름 한자의 자원오행",
        `<p class="datanote">한자마다 지닌 오행(자원오행字源五行)과 원획으로 봅니다. 부수 계열 기반 참고이며, 유파에 따라 다를 수 있습니다.</p>`,
        `<div class="name-chips">${hchips}</div>`,
        hcomp
      );
      if (ha.totalStrokes) {
        // 획수 길흉 판정 안 함 고지는 리포트 하단 면책(NAME_STROKE_NOTICE)으로 모은다.
        hanjaBlock.push(
          `이름 한자의 원획 합은 **${ha.totalStrokes}획**입니다.`
        );
      }

      // ── 두 관점 종합 — 소리(발음오행)와 한자(자원오행)가 서로 다른 결론을
      //    낼 수 있어(강점 강화 vs 부족 보완), 부모가 헷갈리지 않도록 묶어 준다.
      const dir = (t: string) =>
        t === "강화"
          ? `타고난 강점인 ${a.strongEl}(${strongH}) 기운을 밀어주는`
          : t === "보완"
            ? `부족한 ${a.weakEl}(${weakH}) 기운을 채워 주는`
            : `사주와 무난히 어우러지는`;
      const st = a.complementType;
      const ht = ha.complementType;
      let synth: string;
      if (st === ht) {
        if (st === "보완") {
          synth =
            `**소리로 봐도 한자로 봐도, '${nmE}'는 사주에 부족한 ${a.weakEl}(${weakH}) 기운을 채워 주는 이름입니다.** ` +
            `두 관점이 한목소리를 내는, 보기 드물게 결이 잘 맞는 이름이에요.`;
        } else if (st === "강화") {
          synth =
            `**소리로 봐도 한자로 봐도, '${nmE}'는 타고난 강점인 ${a.strongEl}(${strongH}) 기운을 밀어주는 이름입니다.** ` +
            `강점을 또렷하게 세워 주는 이름이며, 사주에 옅은 ${a.weakEl}(${weakH}) 기운은 이름 밖 생활 속 활동으로 채워 주시면 균형이 좋아집니다.`;
        } else {
          synth =
            `소리로 봐도 한자로 봐도, '${nmE}'는 사주와 큰 무리 없이 어우러지는 이름입니다. ` +
            `특정 기운을 크게 더하거나 빼지 않고 조화롭게 놓입니다.`;
        }
      } else if ((st === "강화" && ht === "보완") || (st === "보완" && ht === "강화")) {
        synth =
          `흥미롭게도 두 관점의 초점이 다릅니다. **이름의 소리는 ${dir(st)} 쪽이고, 한자는 ${dir(ht)} 쪽이에요.** ` +
          `어긋나는 게 아니라, 한 이름이 '강점은 북돋우고 부족함은 채우는' 두 역할을 함께 맡은 셈입니다. ` +
          `그래서 '${nmE}'는 타고난 결을 살리면서 빈자리도 메우는, 균형 잡힌 이름으로 볼 수 있어요.`;
      } else {
        synth =
          `두 관점이 서로 다른 곳을 짚습니다. **이름의 소리는 ${dir(st)} 쪽, 한자는 ${dir(ht)} 쪽이에요.** ` +
          `어느 하나가 틀린 게 아니라 서로 다른 잣대로 본 것이며, 종합하면 '${nmE}'는 한 이름 안에 여러 결을 함께 품은 이름이라고 볼 수 있습니다.`;
      }
      hanjaBlock.push("### 소리와 한자, 종합하면", synth);
    }
  }

  const closing =
    `무엇보다 이름에는 부모님이 담은 뜻과 바람이 깃들어 있습니다. ` +
    `위 오행 해석은 그 위에 더하는 하나의 참고일 뿐, 아이를 부르는 그 이름이 이미 가장 큰 선물입니다.`;

  return [
    "## 이름과 사주의 어울림",
    `<p class="datanote">성명학의 발음오행(音靈五行, 이름 소리의 오행) 관점에서, 이름 '${nmE}'${subjectParticle(nm)} 사주와 어떻게 어울리는지 살펴봅니다. 사주 명리와는 별개의 전통 해석이며 참고용입니다.</p>`,
    "### 이름 소리에 담긴 오행",
    `<div class="name-chips">${chips}</div>`,
    comp,
    flow,
    ...hanjaBlock,
    "### 부족한 기운, 이렇게 채워 주세요",
    supIntro,
    supCard,
    closing,
  ]
    .filter(Boolean)
    .join("\n\n");
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

  // ── 한 장 요약 (데이터 기반, 맨 앞) ──────────────────────
  sections.push({ title: "우리 아이 한 장 요약", body: buildSummarySection(saju, meta.childName, meta.childNameHanja) });

  // ── 짧은 활용 가이드 (정적) — 상세 사주 설명은 맨 뒤 부록으로 이동 ──
  sections.push({ title: "이 리포트, 이렇게 보세요", body: HOW_TO_READ });

  // ── 원국 (도식 + 사전) ─────────────────────────────────
  sections.push({
    title: "사주 원국 (四柱原局)",
    body:
      chapterDivider(1, "타고난 결", "우리 아이가 타고난 성정과 기운", "ch1") +
      "\n\n## 사주 원국 (四柱原局)\n\n" +
      buildSajuChart(saju) +
      `\n\n<p class="datanote">원 안은 여덟 글자(위 = 천간, 아래 = 지지), 원 색은 오행입니다. 글자 곁 작은 글씨는 십성(일간과의 관계), 파란 테두리가 아이 자신을 뜻하는 <b>일간</b>입니다.</p>\n\n` +
      "### 내 여덟 글자 풀이\n\n" +
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

  // ── 이름과 사주 (성명학 라이트 — 이름 있을 때만) ──────────
  const nameSection = buildNameSajuSection(saju, meta.childName, meta.childNameHanja);
  if (nameSection) {
    sections.push({ title: "이름과 사주의 어울림", body: nameSection });
  }

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
      chapterDivider(2, "공부 이야기", "어떻게 배울 때 가장 빛나는가", "ch2") +
      "\n\n## 공부 스타일과 학습 환경\n\n" +
      perspective.studyStyleProse +
      "\n\n### 기질 지표\n\n" +
      traitsRadarChart(saju),
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

  // ── 강점 분야 (관점) — 진로 상세는 다음 섹션 ─────────────
  sections.push({
    title: "강점 분야",
    body:
      chapterDivider(3, "강점과 진로", "무엇을 잘하고 어디로 나아갈까", "ch3") +
      "\n\n## 강점 분야\n\n" +
      perspective.aptitudeProse,
  });

  // ── 진로·전공 경향 (데이터 + 관점) ───────────────────────
  // 직업/전공 표가 열 구성까지 동일해 두 번 보이던 중복 → 통합 표 하나로.
  sections.push({
    title: "진로·전공 경향 참고",
    body:
      "## 진로·전공 경향 참고\n\n" +
      buildCareerMajorMapSection(saju) +
      "\n\n### 직업군 경향\n\n" +
      perspective.careerProse +
      "\n\n### 전공·학문 계열과 진학 방향\n\n" +
      perspective.majorProse,
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
        chapterDivider(4, "성장의 흐름", "단계마다 무엇을 챙기면 좋을까", "ch4") +
        `\n\n## 지금 우리 아이는 — ${stage.label}\n` +
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

  // ── 성장 로드맵: 유아기→초등→중등→고등→대학·진로 (관점) ────
  sections.push({
    title: "성장 로드맵 — 유아기부터 진로까지",
    body:
      "## 성장 로드맵 — 유아기부터 진로까지\n\n" +
      "유아기·초등·중등·고등·대학/진로 각 단계에서 이 아이 기질에 무엇이 좋고, 어떻게 발전시켜 주면 좋을지 단계별로 정리했습니다.\n\n" +
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

  // ── 학교 기질 참고 (관점 + 기질 유형 표) ──────────────────
  const typeScores = deriveSchoolTypeScores(saju);
  const starsStr = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
  const scoreRows = typeScores.map(
    (s) => `| ${s.label} | ${starsStr(s.stars)} | ${s.reason} |`
  );
  const typeTableBlock = [
    "",
    "### 기질로 본 고교 유형 참고",
    "",
    "| 고교 유형 | 기질 적합도 | 참고 |",
    "|---|---|---|",
    ...scoreRows,
  ].join("\n");

  sections.push({
    title: "학교 선택 기질 참고",
    body:
      "## 학교 선택 기질 참고\n\n" +
      "> 아래는 사주 기질 관점에서 학교 환경 선택 시 참고할 만한 경향입니다.\n" +
      "> 특정 학교를 추천하거나 정답으로 지목하지 않습니다.\n\n" +
      perspective.schoolConnectionProse +
      typeTableBlock,
  });

  // ── 예상 배정 학교 + 주변 학교군 (사실 블록 — 코드 삽입) ───
  // 배정/통학구역 데이터는 초등 기준이라, 고등학생·졸업 이후에는 맞지 않아 생략한다.
  // (기질 기반 "고교 유형 참고"는 위에서 이미 제공)
  const stageKey =
    meta.birthYear !== undefined
      ? deriveSchoolStage(meta.birthYear, currentYear).key
      : undefined;
  const skipAssignedSchools = stageKey === "high" || stageKey === "post-school";

  if (facts.assignedSchoolSection && !skipAssignedSchools) {
    sections.push({
      title: "예상 배정 학교 (사실 정보)",
      body:
        "## 예상 배정 학교 (사실 정보)\n\n" +
        "> 아래는 사주 해석과 무관한 공공데이터 기반 사실 정보입니다.\n\n" +
        facts.assignedSchoolSection,
    });
  }

  if (facts.clusterSection && !skipAssignedSchools) {
    sections.push({
      title: "주변 학교 현황",
      body: "## 주변 학교 현황\n\n" + facts.clusterSection,
    });
  }

  // ── 부록 (정적) — 상세 설명·기초·용어는 맨 뒤로 ───────────
  sections.push({ title: "부록 · 사주팔자 기초", body: SAJU_BASICS });
  sections.push({ title: "자주 묻는 질문", body: FAQ });
  sections.push({ title: "용어 풀이", body: GLOSSARY });

  // ── 목차 생성 (고급 스타일 HTML 내비게이션) ──────────────
  //  마크다운 링크 리스트 대신 번호 칩 + 2단 그리드 카드로 렌더한다.
  //  PDF로 뽑으면 링크는 비활성이지만 번호+제목의 깔끔한 목차 페이지로 남는다.
  const escToc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toc =
    `<nav class="toc" aria-label="목차">\n` +
    `<div class="toc-title">목차</div>\n` +
    `<ol class="toc-list">\n` +
    sections
      .map(
        (s, i) =>
          `<li><a href="#sec-${i + 1}"><span class="toc-num">${String(i + 1).padStart(2, "0")}</span><span class="toc-label">${escToc(s.title)}</span></a></li>`
      )
      .join("\n") +
    `\n</ol>\n</nav>`;

  // ── 최종 조립 (각 섹션 앞에 앵커 삽입 → 목차에서 점프) ───
  const body = sections
    .map((s, i) => `<a id="sec-${i + 1}"></a>\n\n${s.body}`)
    .join("\n\n---\n\n");

  const notices = [TIME_STANDARD_NOTICE];
  if (saju.dstApplied) notices.push(DST_CORRECTION_NOTICE);
  // 이름 한자를 받은 리포트에만 원획 길흉 관련 고지를 하단에 추가
  if (meta.childName?.trim() && meta.childNameHanja?.trim()) notices.push(NAME_STROKE_NOTICE);
  notices.push(INTERPRETATION_NOTICE);

  // join이 이미 각 블록 사이에 구분선(---)을 넣으므로, 면책 블록에 별도 "---"를
  // 앞에 붙이면 구분선이 두 번 나온다(빈 구분선처럼 보임).
  return [
    toc,
    body,
    notices.join("\n\n"),
  ].join("\n\n---\n\n");
}
