/**
 * lib/saju/pillars.ts
 * 생년월일시+성별 → SajuResult (사주팔자·오행·십성·대운·기질)
 *
 * lunar-javascript EightChar API를 래핑한다.
 *
 * [주의] 이 모듈의 사주 계산은 lunar-javascript 기반 자체 일관성 검증 상태입니다.
 * TODO [외부 권위 대조]: 결과를 권위 있는 한국 만세력(예: 대한사주학회 기준)과
 * 반드시 대조해야 합니다. "정확하다"고 단정하지 마십시오.
 *
 * [절대 규칙] lib/saju 는 lib/schools 를 절대 import 하지 않는다.
 */

import { Solar } from "lunar-javascript";
import type { SajuInput, SajuResult } from "./types";
import { applyTrueSolarTime } from "./calendar";
import { computeElements, computeTenGods } from "./elements";
import { computeDaeun } from "./daeun";
import { computeTraits } from "./traits";

/**
 * 생년월일시+성별을 받아 SajuResult를 반환한다.
 *
 * 동작 규칙:
 * - birthHour 미지정 → 時柱 = null (추정·날조 금지)
 * - useTrueSolarTime 기본 false: 동경 135° 표준시(KST) 기준으로 계산 (절대 규칙)
 *   진태양시 보정을 원할 때만 true로 명시 전달.
 * - 절기(節) 기준 月柱는 lunar-javascript가 처리 (입춘으로 年 경계 포함)
 */
export function computeSaju(input: SajuInput): SajuResult {
  const {
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute = 0,
    gender,
    useTrueSolarTime = false,
  } = input;

  const hasTime = birthHour !== undefined;

  // 1. 진태양시 보정
  let adjYear = birthYear;
  let adjMonth = birthMonth;
  let adjDay = birthDay;
  let adjHour = hasTime ? birthHour! : 12; // 시간 모름 시 정오 임시값 (時柱에 미사용)
  let adjMinute = birthMinute;

  if (hasTime && useTrueSolarTime) {
    const adj = applyTrueSolarTime(
      birthYear,
      birthMonth,
      birthDay,
      birthHour!,
      birthMinute
    );
    adjYear = adj.year;
    adjMonth = adj.month;
    adjDay = adj.day;
    adjHour = adj.hour;
    adjMinute = adj.minute;
  }

  // 2. lunar-javascript EightChar 계산
  // 時柱 미지정 시 정오(12:00) 기준으로 日柱 이전 기둥을 계산한다.
  // (자정 0:00을 쓰면 자시(子時) 경계 문제로 日柱가 달라질 수 있음)
  const solar = Solar.fromYmdHms(adjYear, adjMonth, adjDay, adjHour, adjMinute, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  // 3. 4기둥 추출
  const pillars = {
    year: ec.getYear() as string,
    month: ec.getMonth() as string,
    day: ec.getDay() as string,
    hour: hasTime ? (ec.getTime() as string) : null,
  };

  // 4. 오행 분포
  const wuXingParts: string[] = [
    ec.getYearWuXing() as string,
    ec.getMonthWuXing() as string,
    ec.getDayWuXing() as string,
    ...(hasTime ? [ec.getTimeWuXing() as string] : []),
  ];
  const elements = computeElements(wuXingParts);

  // 5. 십성 분포
  const tenGods = computeTenGods(ec, hasTime);

  // 6. 대운
  const daeun = computeDaeun(ec, gender);

  // 7. 기질 점수 (레이더 6축, 해석 지표)
  const traitScores = computeTraits(elements, tenGods);

  return { pillars, elements, tenGods, daeun, traitScores };
}
