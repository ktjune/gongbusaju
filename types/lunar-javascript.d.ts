/**
 * lunar-javascript 최소 타입 선언
 * 패키지가 .d.ts를 제공하지 않아 직접 정의.
 * lib/saju에서 실제로 호출하는 API만 선언한다.
 */
declare module "lunar-javascript" {
  class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number
    ): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): Lunar;
  }

  class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    isLeap(): boolean;
    getSolar(): Solar;
    getEightChar(): EightChar;
    getPrevJie(includeCurrentDay?: boolean): Jie | null;
    /** 연간지 (입춘 절입시각 기준 정밀) — 세운 표시용 */
    getYearInGanZhiExact(): string;
  }

  class EightChar {
    // 4기둥 간지
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;

    // 오행(五行)
    getYearWuXing(): string;
    getMonthWuXing(): string;
    getDayWuXing(): string;
    getTimeWuXing(): string;

    // 십성(十神) 천간
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getTimeShiShenGan(): string;

    // 십성(十神) 지지 (장간 포함, 쉼표 구분 문자열)
    getYearShiShenZhi(): string;
    getMonthShiShenZhi(): string;
    getDayShiShenZhi(): string;
    getTimeShiShenZhi(): string;

    // 대운
    getYun(gender: number): Yun;
  }

  class Yun {
    /** 출생일로부터 첫 대운 시작까지 경과 연수 (만나이 연 단위) */
    getStartYear(): number;
    /** 경과 연수 이후 추가 개월 수 (0~11) */
    getStartMonth(): number;
    /** 경과 개월 이후 추가 일수 */
    getStartDay(): number;
    getDaYun(count: number): DaYun[];
  }

  class DaYun {
    getStartAge(): number;
    getGanZhi(): string;
  }

  class Jie {
    getName(): string;
  }
}
