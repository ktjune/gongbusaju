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
  age: number; // 시작 나이
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
  /**
   * 진태양시 보정 사용 여부 (기본 true)
   * 한국 표준시 동경 135° vs 실제 ~127° → 약 -32분 보정
   */
  useTrueSolarTime?: boolean;
};
