/**
 * lib/report/nameology-hanja.ts
 * 성명학(자원오행) — 이름 한자의 자원오행이 사주를 어떻게 보완하는지 분석.
 *
 * [원칙]
 * - 한자별 자원오행·원획은 data-pipeline/hanja/hanja.json(Unihan 기반, 합법)에서 조회.
 * - 이름 한자는 LLM에 전송하지 않는다 — 이 분석은 전부 코드가 계산한다.
 * - 절대 "흉명/개명" 판정을 하지 않는다. 수리 길흉도 하지 않는다. 오행 보완만, 긍정·참고 프레임.
 */

import type { SajuResult } from "../saju";
import hanjaData from "../../data-pipeline/hanja/hanja.json";

type HanjaEntry = { strokes: number; radical: number; element: string; sound: string };
const DB = hanjaData as Record<string, HanjaEntry>;

/** 한자 한 글자의 자원오행·원획 조회 (없으면 null) */
export function lookupHanja(ch: string): HanjaEntry | null {
  return DB[ch] ?? null;
}

export type HanjaNameAnalysis = {
  chars: Array<{ char: string; element: string | null; strokes: number | null; sound: string | null }>;
  /** null 제외한 자원오행 목록 */
  elements: string[];
  /** 이름이 사주에 대해: 보완(약한 기운 채움) / 강화(강한 기운 더함) / 조화(중립) */
  complementType: "보완" | "강화" | "조화";
  weakEl: string;
  strongEl: string;
  /** 이름 원획 합 (모든 글자 조회될 때만) */
  totalStrokes: number | null;
};

/**
 * 이름 한자와 사주로 자원오행 어울림을 분석한다.
 * 조회되는 한자가 하나도 없으면 null (섹션 생략).
 */
export function analyzeNameHanja(hanja: string, saju: SajuResult): HanjaNameAnalysis | null {
  const syllables = [...hanja.trim()].filter((c) => c.trim().length > 0);
  const chars = syllables.map((c) => {
    const e = DB[c];
    return {
      char: c,
      element: e?.element ?? null,
      strokes: e?.strokes ?? null,
      sound: e?.sound ?? null,
    };
  });
  const elements = chars
    .map((c) => c.element)
    .filter((e): e is string => e !== null);
  if (elements.length === 0) return null;

  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];
  const withPct = order.map(([el, k]) => ({ el, pct: saju.elements[k] }));
  const strongEl = [...withPct].sort((a, b) => b.pct - a.pct)[0].el;
  const weakEl = [...withPct].sort((a, b) => a.pct - b.pct)[0].el;

  let complementType: HanjaNameAnalysis["complementType"];
  if (elements.includes(weakEl)) complementType = "보완";
  else if (elements.includes(strongEl)) complementType = "강화";
  else complementType = "조화";

  const totalStrokes = chars.every((c) => c.strokes != null)
    ? chars.reduce((a, c) => a + (c.strokes ?? 0), 0)
    : null;

  return { chars, elements, complementType, weakEl, strongEl, totalStrokes };
}
