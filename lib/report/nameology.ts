/**
 * lib/report/nameology.ts
 * 성명학 라이트 — 발음오행(音靈五行)으로 이름-사주 어울림 분석.
 *
 * [원칙]
 * - 한자 없이 한글 이름의 초성만으로 오행을 산출한다 (현대 작명 주류 방식).
 * - 이름은 LLM에 전송하지 않는다 — 이 분석은 전부 코드가 계산한다.
 * - 절대 "흉명/나쁜 이름/개명" 판정을 하지 않는다. 관계는 긍정·참고 프레임으로만.
 */

import type { SajuResult } from "../saju";

// 초성 인덱스(0~18) → 오행. 훈민정음 오음 기준 음령오행.
//  0ㄱ 1ㄲ 2ㄴ 3ㄷ 4ㄸ 5ㄹ 6ㅁ 7ㅂ 8ㅃ 9ㅅ 10ㅆ 11ㅇ 12ㅈ 13ㅉ 14ㅊ 15ㅋ 16ㅌ 17ㅍ 18ㅎ
//  ㄱㅋ=木 / ㄴㄷㄹㅌ=火 / ㅁㅂㅍ=水 / ㅅㅈㅊ=金 / ㅇㅎ=土
const CHO_TO_ELEMENT: readonly string[] = [
  "木", "木", "火", "火", "火", "火", "水", "水", "水",
  "金", "金", "土", "金", "金", "金", "木", "火", "水", "土",
];

/** 한글 음절 한 글자의 초성 오행 (한글 음절이 아니면 null) */
export function choElement(syllable: string): string | null {
  const code = syllable.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const cho = Math.floor((code - 0xac00) / 588);
  return CHO_TO_ELEMENT[cho] ?? null;
}

/** 오행 상생 순환 (목→화→토→금→수→목) */
const SHENG_NEXT: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

/** 두 오행의 관계 */
export function elementRelation(a: string, b: string): "비화" | "상생" | "상극" {
  if (a === b) return "비화";
  if (SHENG_NEXT[a] === b || SHENG_NEXT[b] === a) return "상생";
  return "상극";
}

export type NameAnalysis = {
  /** 글자별 초성 오행 (한글 아니면 element=null) */
  chars: Array<{ syllable: string; element: string | null }>;
  /** null 제외한 오행 목록 */
  elements: string[];
  /** 이름이 사주에 대해: 보완(약한 기운 채움) / 강화(강한 기운 더함) / 조화(중립) */
  complementType: "보완" | "강화" | "조화";
  /** 사주에서 가장 약한/강한 오행(한자) */
  weakEl: string;
  strongEl: string;
  /** 이름 글자 간 흐름: 상생 / 비화(같음) / 상극 / 단독(1글자) */
  flow: "상생" | "비화" | "상극" | "단독";
};

/**
 * 이름(한글)과 사주로 발음오행 어울림을 분석한다.
 * 한글 음절이 하나도 없으면 null (섹션 생략).
 */
export function analyzeName(name: string, saju: SajuResult): NameAnalysis | null {
  const syllables = [...name.trim()].filter((c) => c.trim().length > 0);
  const chars = syllables.map((s) => ({ syllable: s, element: choElement(s) }));
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

  let complementType: NameAnalysis["complementType"];
  if (elements.includes(weakEl)) complementType = "보완";
  else if (elements.includes(strongEl)) complementType = "강화";
  else complementType = "조화";

  let flow: NameAnalysis["flow"] = "단독";
  if (elements.length >= 2) {
    let hasClash = false;
    let hasSheng = false;
    for (let i = 0; i < elements.length - 1; i++) {
      const rel = elementRelation(elements[i], elements[i + 1]);
      if (rel === "상극") hasClash = true;
      if (rel === "상생") hasSheng = true;
    }
    flow = hasClash ? "상극" : hasSheng ? "상생" : "비화";
  }

  return { chars, elements, complementType, weakEl, strongEl, flow };
}
