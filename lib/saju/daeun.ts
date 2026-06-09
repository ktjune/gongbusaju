/**
 * lib/saju/daeun.ts
 * 대운(大運) 계산
 *
 * lunar-javascript의 Yun API를 래핑한다.
 *
 * 순행/역행 결정:
 *   陽男陰女 → 순행, 陰男陽女 → 역행
 *   (lunar-javascript가 내부 처리, gender 코드만 전달)
 *
 * [나이 표기 기준]
 * Yun.getStartYear()/getStartMonth()/getStartDay()는 출생일로부터의 경과 시간이다.
 * (getStartSolar() = birthDate.nextYear(Y).nextMonth(M).next(D)로 검증됨)
 * 출생 후 경과 시간 = 만나이이므로, DaYun.getStartAge()(세는나이) 대신 이 값을 사용한다.
 *   - 첫 대운: age = yun.getStartYear(), startMonths = yun.getStartMonth()
 *   - n번째 대운: age = yun.getStartYear() + (n-1)*10, startMonths = yun.getStartMonth()
 */

import type { DaeunStep } from "./types";

/** 표시할 최대 대운 수 */
const MAX_DAEUN = 9;

/**
 * EightChar 객체에서 대운(大運) 목록을 계산한다.
 *
 * @param eightChar lunar-javascript EightChar 객체
 * @param gender    성별
 * @returns 시작 만나이 오름차순 대운 목록
 */
export function computeDaeun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eightChar: any,
  gender: "male" | "female"
): DaeunStep[] {
  // lunar-javascript: 1=男(남), 0=女(여)  ← 주의: 직관과 반대
  // 소스 확인: `var man = 1 === gender;` (lunar.js getYun)
  const genderCode = gender === "male" ? 1 : 0;
  const yun = eightChar.getYun(genderCode);

  // 출생 후 첫 대운까지 경과 시간 (만나이 기준)
  const baseYear: number = yun.getStartYear();   // 경과 연수
  const baseMonth: number = yun.getStartMonth(); // 추가 개월 (0~11)

  const daYunList = yun.getDaYun(MAX_DAEUN + 1); // +1: da[0]은 빈 ganji이므로 skip 후 MAX_DAEUN 확보

  // da[0]은 대운 시작 전 과도기(胎元 등)로 干支가 빈 문자열이다. 제외한다.
  const filtered = (daYunList as unknown[]).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (da: unknown) => (da as any).getGanZhi() !== ""
  );

  return filtered.map((da: unknown, i: number) => ({
    // 만나이: 첫 대운은 baseYear, 이후 10년씩 증가
    age: baseYear + i * 10,
    // 개월 수: 모든 대운에 동일 (예: "만 5세 10개월부터")
    startMonths: baseMonth,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ganji: (da as any).getGanZhi() as string,
  }));
}
