/**
 * lib/saju/pillars.ts
 * 생년월일시+성별 → SajuResult (사주팔자·오행·십성·대운·기질)
 *
 * lunar-javascript EightChar API를 래핑한다.
 *
 * [시각 기준 이원화 — 한국 주류 만세력 관행]
 * 1) 연주·월주·대운 (절기 비교):
 *    절기 비교에는 진태양시 -30분 보정을 적용하지 않고 KST 그대로 비교한다.
 *    단, lunar-javascript 내부 절기 시각은 CST(UTC+8)이므로 KST 입력을
 *    -60분 시프트해 같은 시간대로 맞춘다 (toJieqiBasis).
 *    → 연주·월주 경계가 KASI 발표 절입시각(KST)과 일치.
 * 2) 일주·시주:
 *    동경 127.5° 경도 보정 -30분 적용 (applyTrueSolarTime, 항상 ON).
 *    일주는 보정 자정(= KST 00:30) 기준으로 바뀐다 — 야자시(夜子時)파.
 *    * 23:30~00:30 KST 출생: 일주는 당일 유지, 시주는 익일 일간 기준 子時.
 *    * 정자시(正子時)파(23:30 KST부터 익일 일주)와 학파가 갈리는 지점.
 *      TODO [점신 대조]: 23:40 출생 케이스로 점신과 일주 비교 필요.
 *      다르면 EightChar.setSect(1)로 전환 (한 줄 변경).
 *
 * [주의] 이 모듈의 사주 계산은 lunar-javascript 기반 자체 일관성 검증 상태입니다.
 * TODO [외부 권위 대조]: 결과를 권위 있는 한국 만세력(예: 대한사주학회 기준)과
 * 반드시 대조해야 합니다. "정확하다"고 단정하지 마십시오.
 *
 * [절대 규칙] lib/saju 는 lib/schools 를 절대 import 하지 않는다.
 */

import { Solar } from "lunar-javascript";
import type { SajuInput, SajuResult } from "./types";
import { applyTrueSolarTime, toJieqiBasis } from "./calendar";
import { computeElements, computeTenGods } from "./elements";
import { computeDaeun } from "./daeun";
import { computeTraits } from "./traits";

/** 날짜+시각으로 lunar-javascript EightChar를 만든다. */
function eightCharOf(t: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any {
  return Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0)
    .getLunar()
    .getEightChar();
}

/**
 * 생년월일시+성별을 받아 SajuResult를 반환한다.
 *
 * 동작 규칙:
 * - birthHour 미지정 → 時柱 = null (추정·날조 금지). 정오 임시값으로 나머지 계산.
 * - 연주·월주·대운: 절기 비교 기준 (KST 그대로, lunar-js CST 어댑터 -60분)
 * - 일주·시주: 동경 127.5° -30분 보정 (항상 ON, 토글 없음)
 * - 오행·십성: 확정된 4기둥에서 자체 환산표로 계산 (십성은 본기 위주 — 점신식)
 */
export function computeSaju(input: SajuInput): SajuResult {
  const {
    birthYear,
    birthMonth,
    birthDay,
    birthHour,
    birthMinute = 0,
    gender,
  } = input;

  const hasTime = birthHour !== undefined;
  // 시간 모름 시 정오 임시값 (時柱에 미사용. 자정 0:00을 쓰면 자시 경계로 日柱가 흔들림)
  const hour = hasTime ? birthHour! : 12;
  const minute = hasTime ? birthMinute : 0;

  // 1. 연주·월주·대운용 EightChar — 절기 비교 기준 (KST → CST 어댑터)
  const ecJieqi = eightCharOf(
    toJieqiBasis(birthYear, birthMonth, birthDay, hour, minute)
  );

  // 2. 일주·시주용 EightChar — 동경 127.5° -30분 보정
  //    (sect 기본값 2 = 야자시: 보정 자정에 일주 변경)
  const ecDay = eightCharOf(
    applyTrueSolarTime(birthYear, birthMonth, birthDay, hour, minute)
  );

  // 3. 4기둥 확정
  const pillars = {
    year: ecJieqi.getYear() as string,
    month: ecJieqi.getMonth() as string,
    day: ecDay.getDay() as string,
    hour: hasTime ? (ecDay.getTime() as string) : null,
  };

  // 4. 오행 분포 (자체 환산표 — 4기둥 글자 기준)
  const elements = computeElements(pillars);

  // 5. 십성 분포 (본기 위주 — 점신식)
  const tenGods = computeTenGods(pillars);

  // 6. 대운 (절기 거리·연간 방향 → 절기 기준 EightChar 사용)
  const daeun = computeDaeun(ecJieqi, gender);

  // 7. 기질 점수 (레이더 6축, 해석 지표)
  const traitScores = computeTraits(elements, tenGods);

  return { pillars, elements, tenGods, daeun, traitScores };
}
