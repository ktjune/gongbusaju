/**
 * lib/saju/elements.ts
 * 오행(五行) 분포% 및 십성(十神) 계산 — 자체 테이블 기반
 *
 * [본기(本氣) 위주 십성 — 점신식]
 * 지지 십성은 지장간 전체가 아니라 본기(주기) 천간 1개로만 집계한다.
 * 한국 주류 만세력 앱(점신 등)의 8글자 표기 방식과 일치:
 *   천간 3개(년·월·시, 일간 제외) + 지지 4개(본기) = 최대 7개 십성.
 *
 * [lunar-javascript 미사용 이유]
 * 연·월주(절기 기준)와 일·시주(-30분 보정 기준)가 서로 다른 시각 기준으로
 * 계산되므로 (pillars.ts 참조), 단일 EightChar의 십성 getter를 쓸 수 없다.
 * 십성·오행은 천체계산이 아닌 고정 환산표이므로 자체 구현이 안전하다.
 *
 * 십성 명칭은 lunar-javascript 간체 표기를 따른다 (七杀, 劫财, 伤官 등)
 * — hanzi.ts SHISHEN_KR·traits.ts 키와 일치.
 */

import type { Elements, FourPillars, TenGods } from "./types";

type WuXing = "木" | "火" | "土" | "金" | "水";

/** 10天干: 오행 + 음양 */
const STEM_INFO: Record<string, { element: WuXing; yang: boolean }> = {
  甲: { element: "木", yang: true },
  乙: { element: "木", yang: false },
  丙: { element: "火", yang: true },
  丁: { element: "火", yang: false },
  戊: { element: "土", yang: true },
  己: { element: "土", yang: false },
  庚: { element: "金", yang: true },
  辛: { element: "金", yang: false },
  壬: { element: "水", yang: true },
  癸: { element: "水", yang: false },
};

/** 12地支: 자체 오행 + 본기(本氣) 천간 */
const BRANCH_INFO: Record<string, { element: WuXing; mainStem: string }> = {
  子: { element: "水", mainStem: "癸" },
  丑: { element: "土", mainStem: "己" },
  寅: { element: "木", mainStem: "甲" },
  卯: { element: "木", mainStem: "乙" },
  辰: { element: "土", mainStem: "戊" },
  巳: { element: "火", mainStem: "丙" },
  午: { element: "火", mainStem: "丁" },
  未: { element: "土", mainStem: "己" },
  申: { element: "金", mainStem: "庚" },
  酉: { element: "金", mainStem: "辛" },
  戌: { element: "土", mainStem: "戊" },
  亥: { element: "水", mainStem: "壬" },
};

/** 상생(相生): 木→火→土→金→水→木 */
const SHENG: Record<WuXing, WuXing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

/** 상극(相剋): 木→土, 土→水, 水→火, 火→金, 金→木 */
const KE: Record<WuXing, WuXing> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

/**
 * 일간(日干) 대비 다른 천간의 십성을 결정한다.
 *
 * 규칙 (오행 관계 × 음양 동이):
 * - 같은 오행:        같은 음양 → 比肩, 다름 → 劫财
 * - 일간이 생(生)함:  같은 음양 → 食神, 다름 → 伤官
 * - 일간이 극(剋)함:  같은 음양 → 偏财, 다름 → 正财
 * - 일간을 극함:      같은 음양 → 七杀(偏官), 다름 → 正官
 * - 일간을 생함:      같은 음양 → 偏印, 다름 → 正印
 */
export function tenGodOf(dayStem: string, otherStem: string): string {
  const d = STEM_INFO[dayStem];
  const o = STEM_INFO[otherStem];
  if (!d || !o) {
    throw new Error(`알 수 없는 천간: ${dayStem} / ${otherStem}`);
  }
  const same = d.yang === o.yang;
  if (o.element === d.element) return same ? "比肩" : "劫财";
  if (SHENG[d.element] === o.element) return same ? "食神" : "伤官";
  if (KE[d.element] === o.element) return same ? "偏财" : "正财";
  if (KE[o.element] === d.element) return same ? "七杀" : "正官";
  return same ? "偏印" : "正印";
}

/** 간지 문자열에서 [천간, 지지]를 추출한다. */
function splitGanji(ganji: string): [string, string] {
  return [ganji.charAt(0), ganji.charAt(1)];
}

/**
 * 지지의 본기(本氣) 천간을 반환한다. (예: 子→癸, 寅→甲)
 * 리포트 원국 표에서 지지 십성 라벨을 만들 때 사용.
 */
export function branchMainStem(branch: string): string | null {
  return BRANCH_INFO[branch]?.mainStem ?? null;
}

/**
 * 4기둥에서 오행 분포(백분율)를 계산한다.
 *
 * 글자 단위 집계: 천간은 천간 오행, 지지는 지지 자체 오행(寅=木, 子=水 등).
 * 시주 null이면 6글자, 있으면 8글자 기준.
 */
export function computeElements(pillars: FourPillars): Elements {
  const counts: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  let total = 0;

  const ganjiList = [pillars.year, pillars.month, pillars.day];
  if (pillars.hour) ganjiList.push(pillars.hour);

  for (const ganji of ganjiList) {
    const [gan, zhi] = splitGanji(ganji);
    const stem = STEM_INFO[gan];
    const branch = BRANCH_INFO[zhi];
    if (stem) {
      counts[stem.element]++;
      total++;
    }
    if (branch) {
      counts[branch.element]++;
      total++;
    }
  }

  if (total === 0) return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  return {
    목: (counts["木"] / total) * 100,
    화: (counts["火"] / total) * 100,
    토: (counts["土"] / total) * 100,
    금: (counts["金"] / total) * 100,
    수: (counts["水"] / total) * 100,
  };
}

/**
 * 십성(十神) 분포를 본기 위주로 집계한다.
 *
 * 집계 대상 (일간 자신은 제외):
 * - 천간: 년간·월간·시간 → 일간과 직접 비교
 * - 지지: 년지·월지·일지·시지 → 본기 천간으로 환산 후 비교
 *
 * 시주 null이면 천간 2 + 지지 3 = 5개, 있으면 3 + 4 = 7개.
 */
export function computeTenGods(pillars: FourPillars): TenGods {
  const dayStem = pillars.day.charAt(0);
  const result: TenGods = {};

  const add = (stem: string) => {
    const god = tenGodOf(dayStem, stem);
    result[god] = (result[god] ?? 0) + 1;
  };

  // [간지, 일주 여부] — 일주가 다른 기둥과 같은 간지일 수 있으므로 위치로 구분
  const entries: Array<[string, boolean]> = [
    [pillars.year, false],
    [pillars.month, false],
    [pillars.day, true],
  ];
  if (pillars.hour) entries.push([pillars.hour, false]);

  for (const [ganji, isDay] of entries) {
    const [gan, zhi] = splitGanji(ganji);
    if (!isDay) add(gan); // 일간(자기 자신) 제외
    const branch = BRANCH_INFO[zhi];
    if (branch) add(branch.mainStem);
  }

  return result;
}
