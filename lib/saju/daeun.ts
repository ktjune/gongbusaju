/**
 * lib/saju/daeun.ts
 * 대운(大運) 계산
 *
 * lunar-javascript의 Yun API를 래핑한다.
 *
 * 순행/역행 결정:
 *   陽男陰女 → 순행, 陰男陽女 → 역행
 *   (lunar-javascript가 내부 처리, gender 코드만 전달)
 */

import type { DaeunStep } from "./types";

/** 표시할 최대 대운 수 */
const MAX_DAEUN = 9;

/**
 * EightChar 객체에서 대운(大運) 목록을 계산한다.
 *
 * @param eightChar lunar-javascript EightChar 객체
 * @param gender    성별
 * @returns 시작 나이 오름차순 대운 목록
 */
export function computeDaeun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eightChar: any,
  gender: "male" | "female"
): DaeunStep[] {
  // lunar-javascript: 0=男(남), 1=女(여)
  const genderCode = gender === "male" ? 0 : 1;
  const yun = eightChar.getYun(genderCode);

  // getStartYear() = 대운이 처음 시작하는 나이(년 단위)
  const startAge: number = yun.getStartYear();
  const daYunList = yun.getDaYun(MAX_DAEUN + 1); // +1: da[0]은 빈 ganji이므로 skip 후 MAX_DAEUN 확보

  // da[0]은 대운 시작 전 과도기(胎元 등)로 干支가 빈 문자열이다. 제외한다.
  return (daYunList as unknown[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((da: unknown) => (da as any).getGanZhi() !== "")
    .map((da: unknown) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      age: (da as any).getStartAge() as number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ganji: (da as any).getGanZhi() as string,
    }));
}
