/**
 * lib/saju/calendar.ts
 * 양력 ↔ 음력 · 24절기 변환
 *
 * lunar-javascript 라이브러리를 래핑한다.
 * 천체계산 직접 구현 금지 (SPEC §9 "어려운 3곳" #1 참조).
 *
 * TODO [외부 권위 대조]: 이 모듈의 절기 날짜 계산은 lunar-javascript 라이브러리
 * 기반이며 자체 일관성만 검증된 상태입니다.
 * 최종 정확도는 한국천문연구원(KASI) 또는 권위 있는 만세력과 대조 필요.
 */

import { Solar, Lunar } from "lunar-javascript";

/**
 * 사주 月柱 결정에 쓰는 12節 (절) → 사주 월 (1=인월, ..., 12=축월)
 * lunar-javascript 기본 언어(중문 간체)의 절기 이름을 키로 사용한다.
 */
const JIE_TO_SAJU_MONTH: Record<string, number> = {
  小寒: 12, // 축월(丑月) 시작
  立春: 1, //  인월(寅月) 시작
  惊蛰: 2, //  묘월(卯月) 시작
  清明: 3, //  진월(辰月) 시작
  立夏: 4, //  사월(巳月) 시작
  芒种: 5, //  오월(午月) 시작
  小暑: 6, //  미월(未月) 시작
  立秋: 7, //  신월(申月) 시작
  白露: 8, //  유월(酉月) 시작
  寒露: 9, //  술월(戌月) 시작
  立冬: 10, // 해월(亥月) 시작
  大雪: 11, // 자월(子月) 시작
};

/**
 * 주어진 양력 날짜 기준으로 사주 月柱를 결정하는 절기 월을 반환한다.
 *
 * 사주 月柱는 음력이 아니라 24절기(節) 기준:
 * - 입춘(立春) ~ 경칩(惊蛰) 전날 → 인월(1)
 * - 경칩(惊蛰) ~ 청명(清明) 전날 → 묘월(2) …
 *
 * @returns 1-12 (1=인월, 2=묘월, …, 12=축월)
 *
 * NOTE: 시각 정보 없이 날짜만으로 계산하므로 절기 경계일 당일은 라이브러리가
 * inclusive 처리를 하지만, 절기가 오후·야간에 들어오는 경우 오차가 생길 수
 * 있다. 시각 정보가 있으면 getSajuMonthExact()를 사용하라.
 */
export function getSajuMonth(
  year: number,
  month: number,
  day: number
): number {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const prevJie = lunar.getPrevJie(true); // inclusive: 경계 날짜 포함
  if (!prevJie) return 11;
  return JIE_TO_SAJU_MONTH[prevJie.getName()] ?? 11;
}

/**
 * 주어진 양력 날짜+시각 기준으로 사주 月柱를 결정한다.
 * 시각 정보가 있을 때 사용 (절기 경계 정확도 향상).
 */
export function getSajuMonthExact(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const prevJie = lunar.getPrevJie(true);
  if (!prevJie) return 11;
  return JIE_TO_SAJU_MONTH[prevJie.getName()] ?? 11;
}

/**
 * 양력 날짜를 음력으로 변환한다.
 * (사주 月柱에는 사용하지 않음. 음력 표시 목적.)
 */
export function toLunar(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number; isLeap: boolean } {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  return {
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
    isLeap: lunar.isLeap(),
  };
}

/**
 * 음력 날짜를 양력으로 변환한다.
 * (개발 검증 UI 등에서 사용 — lunar-javascript 직접 의존 없이 호출 가능)
 *
 * @param lunarYear  음력 년
 * @param lunarMonth 음력 월 (1-12)
 * @param lunarDay   음력 일
 * @returns 양력 { year, month, day }
 */
export function solarFromLunar(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number
): { year: number; month: number; day: number } {
  const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
  const solar = lunar.getSolar();
  return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
}

/**
 * 진태양시(眞太陽時) 보정 분(minutes)
 *
 * 한국 표준시(KST)는 동경 135° 기준.
 * 임의의 경도에 대한 보정값을 계산한다.
 * 공식: (출생지 경도 - 135) × 4분/도
 *
 * TODO [서머타임]: 한국 서머타임 적용 연도(1948~1960, 1987~1988 등)에 대한
 * 보정값은 확정되지 않았습니다. 해당 연도 출생자는 반드시 사용자가 실제
 * 시간을 확인해야 합니다.
 *
 * @param longitude 출생지 동경 (기본값: 서울 126.97)
 * @returns 분 단위 보정값 (음수 = 빼기)
 */
export function getTrueSolarTimeOffsetMinutes(longitude = 126.97): number {
  const stdLongitude = 135; // KST 기준 경도
  return Math.round((longitude - stdLongitude) * 4); // 서울: 약 -32분
}

/**
 * 동경 127.5° 경도 보정값 (고정).
 *
 * 한국 주류 만세력(점신·정해·천을귀인 등)은 동경 127.5° 기준 -30분으로 時柱를 결정한다.
 * KST(동경 135°) 대비 고정 -30분 적용.
 * 계산: (127.5 - 135) × 4 = -30분
 *
 * 균시차(태양의 실제 이동) 및 출생지 정확 경도는 적용하지 않는다.
 */
export const LONGITUDE_CORRECTION_MINUTES = -30;

/**
 * KST 시각에 동경 127.5° 경도 보정(-30분)을 적용한 날짜+시각을 반환한다.
 *
 * 한국 주류 만세력 관행을 따른다. 균시차·출생지 경도 미적용.
 *
 * @param year   양력 년
 * @param month  양력 월 (1-12)
 * @param day    양력 일
 * @param hour   시 (0-23)
 * @param minute 분 (0-59)
 * @param longitude 무시됨 (하위 호환 유지용, 내부적으로 LONGITUDE_CORRECTION_MINUTES 고정 사용)
 */
export function applyTrueSolarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  longitude?: number // 하위 호환 시그니처 — 내부에서 무시하고 고정 -30분 사용
): { year: number; month: number; day: number; hour: number; minute: number } {
  void longitude; // 의도적 미사용 — 고정 보정값 사용
  // JavaScript Date를 이용해 날짜 넘김 처리
  const date = new Date(year, month - 1, day, hour, minute + LONGITUDE_CORRECTION_MINUTES, 0);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}
