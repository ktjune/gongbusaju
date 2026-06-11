/**
 * lib/saju/traits.ts
 * 기질 매핑 규칙표 — 오행·십성 → 레이더 6축 점수
 *
 * [주의] 이 점수는 해석·참고 지표이며 실증적 측정치가 아닙니다.
 * "예측/최적화" 아닌 "경향/해석"으로만 표시해야 합니다.
 * 축 정의·가중치는 TODO로 표시된 전문가 검토 후 보정 필요.
 */

import type { Elements, TenGods } from "./types";

/** 6축 레이더 키 */
export const TRAIT_KEYS = [
  "집중력",
  "창의력",
  "리더십",
  "분석력",
  "사교성",
  "직관력",
] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

/**
 * 오행 비율과 십성 분포에서 6축 기질 점수(0-100)를 계산한다.
 *
 * TODO [전문가 검토]: 오행·십성 → 기질 축 매핑 가중치는 사주 전문가 또는
 * 역학 자문을 통해 보정이 필요합니다.
 */
export function computeTraits(
  elements: Elements,
  tenGods: TenGods
): Record<TraitKey, number> {
  const totalTenGods =
    Object.values(tenGods).reduce((a, b) => a + b, 0) || 1;

  /** 해당 십성 키들의 비율 (0~1) */
  const godBias = (...keys: string[]) =>
    keys.reduce((sum, k) => sum + (tenGods[k] ?? 0), 0) / totalTenGods;

  // 집중력: 土 오행 + 正印/偏印
  const 집중력 =
    elements.토 * 0.6 + godBias("正印", "偏印") * 100 * 0.4;

  // 창의력: 木 오행 + 食神/伤官
  const 창의력 =
    elements.목 * 0.6 + godBias("食神", "伤官") * 100 * 0.4;

  // 리더십: 火 오행 + 七杀/正官
  // (lunar-javascript는 偏官을 七杀로 표기)
  const 리더십 =
    elements.화 * 0.6 + godBias("七杀", "正官") * 100 * 0.4;

  // 분석력: 金 오행 + 正财/偏财
  const 분석력 =
    elements.금 * 0.6 + godBias("正财", "偏财") * 100 * 0.4;

  // 사교성: 火+木 오행 + 比肩/劫财
  const 사교성 =
    (elements.화 * 0.4 + elements.목 * 0.2) + godBias("比肩", "劫财") * 100 * 0.4;

  // 직관력: 水 오행 + 偏印
  const 직관력 =
    elements.수 * 0.7 + godBias("偏印") * 100 * 0.3;

  /**
   * 전시 대역 보정 (35~95).
   *
   * 원점수 산식(오행%×가중 + 십성비율×가중)은 오행 5축 합 100%·십성 합 100%
   * 구조라 이론상 0~100이어도 실제로는 0~50대만 나온다. 보정 없이 100점
   * 척도로 그리면 모든 아이가 "능력 없음"으로 읽히는 표시 왜곡이 생긴다.
   * 이 수치는 능력 측정이 아니라 성향 강도의 해석 지표이므로,
   * 원점수의 상대 차이를 보존한 채 +35 시프트 후 35~95로 클램프한다.
   */
  const DISPLAY_OFFSET = 35;
  const DISPLAY_MIN = 35;
  const DISPLAY_MAX = 95;
  const toDisplay = (raw: number) =>
    Math.min(DISPLAY_MAX, Math.max(DISPLAY_MIN, Math.round(raw + DISPLAY_OFFSET)));

  return {
    집중력: toDisplay(집중력),
    창의력: toDisplay(창의력),
    리더십: toDisplay(리더십),
    분석력: toDisplay(분석력),
    사교성: toDisplay(사교성),
    직관력: toDisplay(직관력),
  };
}
