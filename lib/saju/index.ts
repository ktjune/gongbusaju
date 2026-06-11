/**
 * lib/saju — 해석 레이어 (결정론, LLM 없음)
 *
 * [절대 규칙] lib/saju 는 lib/schools 를 절대 import 하지 않는다.
 * 두 레이어를 합치는 곳은 오직 lib/report.
 */

export type { SajuResult, SajuInput, FourPillars, Elements, TenGods, DaeunStep } from "./types";
export { computeSaju } from "./pillars";
export { tenGodOf, branchMainStem, stemElement, branchElement } from "./elements";
export { getSajuMonth, getSajuMonthExact, getTrueSolarTimeOffsetMinutes, applyTrueSolarTime, LONGITUDE_CORRECTION_MINUTES, toLunar, solarFromLunar, getYearGanji } from "./calendar";
export {
  TIANGAN_KR, DIZHI_KR, WUXING_KR, SHISHEN_KR,
  ganjiToHangul, withHangul,
  wuxingToHangul, wuxingWithHangul,
  tenGodToHangul, tenGodWithHangul,
  seToMannai, formatMannai, formatDaeunAge,
} from "./hanzi";
