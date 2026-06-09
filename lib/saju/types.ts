/**
 * lib/saju 공개 타입 — SPEC §5 SajuResult 정의
 */

export type Ganji = string; // 예: "甲子", "乙丑"

export type FourPillars = {
  year: Ganji;
  month: Ganji;
  day: Ganji;
  /** 시간을 모를 경우 null (추정·날조 금지) */
  hour: Ganji | null;
};

export type Elements = {
  목: number; // 木 %
  화: number; // 火 %
  토: number; // 土 %
  금: number; // 金 %
  수: number; // 水 %
};

export type TenGods = Record<string, number>; // 십성 분포

export type DaeunStep = {
  /**
   * 대운 시작 만나이 (연 단위).
   * lunar-javascript Yun.getStartYear() 기반 — 출생 후 경과 연수이므로 만나이와 동일.
   * 첫 대운은 getStartYear(), 이후 10년씩 증가.
   */
  age: number;
  /**
   * age에 더해지는 추가 개월 수 (0~11).
   * lunar-javascript Yun.getStartMonth() — 모든 대운에 동일.
   * "만 5세 10개월부터" 형식으로 표기할 때 사용.
   */
  startMonths: number;
  ganji: Ganji;
};

export type SajuResult = {
  pillars: FourPillars;
  elements: Elements;
  tenGods: TenGods;
  daeun: DaeunStep[];
  /** 레이더 6축 — 해석 지표, 측정치 아님 */
  traitScores: Record<string, number>;
};

export type SajuInput = {
  /** 양력 생년월일 */
  birthYear: number;
  birthMonth: number; // 1-12
  birthDay: number;
  /** 시간을 모르면 undefined */
  birthHour?: number; // 0-23
  birthMinute?: number; // 0-59
  gender: "male" | "female";
};
