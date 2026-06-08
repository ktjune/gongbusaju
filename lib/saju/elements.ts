/**
 * lib/saju/elements.ts
 * 오행(五行) 분포% 및 십성(十神) 계산
 *
 * lunar-javascript EightChar 객체에서 데이터를 추출한다.
 */

import type { Elements, TenGods } from "./types";

/** lunar-javascript 기본 언어의 오행 한자 목록 */
const WU_XING_CHARS = new Set(["木", "火", "土", "金", "水"]);

/**
 * WuXing 문자열(2자)에서 오행 목록을 추출한다.
 * e.g., "木火" → ["木", "火"]
 */
function parseWuXing(s: string): string[] {
  return [...s].filter((c) => WU_XING_CHARS.has(c));
}

/**
 * 4기둥 오행 문자열 배열에서 오행 분포(백분율)를 계산한다.
 * @param wuXingParts e.g., ["木火", "土金", "水水", "木土"]
 *                   時柱 미지정 시 3개(年月日)만 전달한다.
 */
export function computeElements(wuXingParts: string[]): Elements {
  const counts: Record<string, number> = {
    木: 0,
    火: 0,
    土: 0,
    金: 0,
    水: 0,
  };
  const all = wuXingParts.flatMap(parseWuXing);
  for (const e of all) {
    counts[e]++;
  }
  const total = all.length;
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
 * 십성(十神) 분포를 집계한다.
 *
 * lunar-javascript 反환 형식:
 * - 天干 십성: 단일 문자열 e.g., "偏财", "正印", "日主"
 * - 地支 십성: 쉼표 구분 문자열 e.g., "正官,劫财,正印" (藏干 포함)
 *
 * 日主는 자기 자신이므로 집계에서 제외한다.
 */
export function computeTenGods(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eightChar: any,
  hasTime: boolean
): TenGods {
  const result: TenGods = {};

  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const part of String(raw).split(",")) {
      const s = part.trim();
      if (s && s !== "日主") {
        result[s] = (result[s] ?? 0) + 1;
      }
    }
  };

  // 天干 십성 (年, 月, 時)
  add(eightChar.getYearShiShenGan?.());
  add(eightChar.getMonthShiShenGan?.());
  if (hasTime) add(eightChar.getTimeShiShenGan?.());

  // 地支 십성 (年, 月, 日, 時) — 장간(藏干) 포함 쉼표 구분
  add(String(eightChar.getYearShiShenZhi?.() ?? ""));
  add(String(eightChar.getMonthShiShenZhi?.() ?? ""));
  add(String(eightChar.getDayShiShenZhi?.() ?? ""));
  if (hasTime) add(String(eightChar.getTimeShiShenZhi?.() ?? ""));

  return result;
}
