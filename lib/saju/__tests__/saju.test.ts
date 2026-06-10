/**
 * lib/saju 만세력 엔진 테스트 (TDD)
 *
 * [테스트 목적]
 * 이 테스트는 lunar-javascript 라이브러리 기반의 자체 일관성(internal consistency)을
 * 검증합니다. 라이브러리 내 데이터와 동일한 결과가 나오는지 확인합니다.
 *
 * [시각 보정 기준 — 이원화]
 * - 일주·시주: 동경 127.5° 경도 보정(-30분) 항상 적용
 * - 연주·월주·대운(절기 비교): 보정 없이 KST를 KASI 절입시각과 직접 비교
 *   (lunar-javascript 절기는 CST(UTC+8)이므로 내부적으로 -60분 어댑터 적용)
 * 이 테스트의 기댓값은 위 기준이 반영된 값입니다.
 *
 * TODO [외부 권위 대조]: 한국천문연구원(KASI) 또는 대한사주학회 등 권위 있는
 * 만세력과 교차 검증이 반드시 필요합니다. 이 테스트 통과 ≠ 절대 정확도 보장.
 */

import { describe, it, expect } from "vitest";
import {
  getSajuMonth,
  getTrueSolarTimeOffsetMinutes,
  applyTrueSolarTime,
  LONGITUDE_CORRECTION_MINUTES,
} from "../calendar";
import { computeSaju } from "../pillars";

// ---------------------------------------------------------------------------
// 1. 절기 기준 月柱
// ---------------------------------------------------------------------------

describe("getSajuMonth — 절기(節) 기준 월주", () => {
  it("입춘(立春) 당일 → 인월(1)", () => {
    // 2024년 입춘 = 2024-02-04
    expect(getSajuMonth(2024, 2, 4)).toBe(1);
  });

  it("입춘 전날 → 축월(12)", () => {
    // 소한(小寒) 이후, 입춘 이전 → 축월
    expect(getSajuMonth(2024, 2, 3)).toBe(12);
  });

  it("경칩(惊蛰) 당일 → 묘월(2)", () => {
    // 2024년 경칩 = 2024-03-05
    expect(getSajuMonth(2024, 3, 5)).toBe(2);
  });

  it("경칩 전날 → 인월(1)", () => {
    expect(getSajuMonth(2024, 3, 4)).toBe(1);
  });

  it("소한(小寒) 당일 → 축월(12)", () => {
    // 2024년 소한 = 2024-01-06
    expect(getSajuMonth(2024, 1, 6)).toBe(12);
  });

  it("대설(大雪) 당일 → 자월(11)", () => {
    // 2024년 대설 = 2024-12-07
    expect(getSajuMonth(2024, 12, 7)).toBe(11);
  });

  it("대설 전날(2024-12-05) → 해월(10)", () => {
    // 2024년 대설 = 12월 6일. 그 전날은 입동~대설 사이 = 해월(10)
    expect(getSajuMonth(2024, 12, 5)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 2. 경도 보정 공식 단위 테스트 (getTrueSolarTimeOffsetMinutes)
// ---------------------------------------------------------------------------

describe("경도 보정 공식 — getTrueSolarTimeOffsetMinutes", () => {
  it("서울 기준(동경 126.97°) 오프셋 = 약 -32분", () => {
    expect(getTrueSolarTimeOffsetMinutes(126.97)).toBe(-32);
  });

  it("부산 기준(약 동경 129°) 오프셋 = -24분", () => {
    expect(getTrueSolarTimeOffsetMinutes(129)).toBe(-24);
  });

  it("표준 경도(135°) 오프셋 = 0분", () => {
    expect(getTrueSolarTimeOffsetMinutes(135)).toBe(0);
  });

  it("LONGITUDE_CORRECTION_MINUTES 상수 = -30 (동경 127.5° 고정값)", () => {
    expect(LONGITUDE_CORRECTION_MINUTES).toBe(-30);
  });
});

// ---------------------------------------------------------------------------
// 3. applyTrueSolarTime — 고정 -30분 보정
// ---------------------------------------------------------------------------

describe("applyTrueSolarTime — 고정 -30분 보정", () => {
  it("15:00 KST → 14:30 (−30분 적용)", () => {
    const adj = applyTrueSolarTime(2000, 6, 1, 15, 0);
    expect(adj.hour).toBe(14);
    expect(adj.minute).toBe(30);
    expect(adj.day).toBe(1); // 날짜 변경 없음
  });

  it("00:10 KST → 전날 23:40 (날짜 넘김)", () => {
    // 2000년은 윤년이므로 2월 29일이 있음
    const adj = applyTrueSolarTime(2000, 3, 1, 0, 10);
    expect(adj.month).toBe(2);
    expect(adj.day).toBe(29); // 날짜가 전날로
    expect(adj.hour).toBe(23);
    expect(adj.minute).toBe(40);
  });

  it("09:19 → 08:49 (시 경계 이동: 巳→辰)", () => {
    // 巳時 경계 09:00. 09:19 → -30분 = 08:49 → 辰時로 이동
    const adj = applyTrueSolarTime(2022, 6, 7, 9, 19);
    expect(adj.hour).toBe(8);
    expect(adj.minute).toBe(49);
  });
});

// ---------------------------------------------------------------------------
// 4. 시간 모름 케이스
// ---------------------------------------------------------------------------

describe("computeSaju — 시간 모름(birthHour 미지정)", () => {
  it("birthHour 없으면 pillars.hour = null", () => {
    const r = computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      gender: "male",
    });
    expect(r.pillars.hour).toBeNull();
  });

  it("시간 모름이어도 年月日 기둥은 계산된다", () => {
    const r = computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      gender: "male",
    });
    expect(r.pillars.year).toBeTruthy();
    expect(r.pillars.month).toBeTruthy();
    expect(r.pillars.day).toBeTruthy();
  });

  it("시간 모름이어도 대운이 계산된다", () => {
    const r = computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      gender: "male",
    });
    expect(r.daeun.length).toBeGreaterThan(0);
    expect(typeof r.daeun[0].age).toBe("number");
    expect(typeof r.daeun[0].ganji).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 5. 알려진 만세력 픽스처 — -30분 보정 적용 후 기댓값
//    (입력 시각의 시 경계로부터 충분히 떨어진 케이스 선택 → 보정 후에도 時柱 동일)
// ---------------------------------------------------------------------------

describe("computeSaju — 알려진 기둥값 검증 (-30분 보정 적용)", () => {
  /**
   * TODO [외부 권위 대조]: 아래 기댓값은 lunar-javascript 라이브러리에서
   * 직접 추출한 값으로, 한국 권위 만세력과의 대조가 아직 이루어지지 않았습니다.
   */

  it("2005-12-23 08:37 → 乙酉 戊子 辛巳 壬辰 (보정 후 08:07, 辰時 유지)", () => {
    const r = computeSaju({
      birthYear: 2005,
      birthMonth: 12,
      birthDay: 23,
      birthHour: 8,
      birthMinute: 37,
      gender: "male",
    });
    expect(r.pillars.year).toBe("乙酉");
    expect(r.pillars.month).toBe("戊子");
    expect(r.pillars.day).toBe("辛巳");
    expect(r.pillars.hour).toBe("壬辰");
  });

  it("1988-02-15 23:30 → 戊辰 甲寅 庚子 戊子 (보정 후 23:00, 子時 유지)", () => {
    // 입춘(1988-02-04 경) 이후 → 戊辰년, 甲寅월(인월)
    const r = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 23,
      birthMinute: 30,
      gender: "male",
    });
    expect(r.pillars.year).toBe("戊辰");
    expect(r.pillars.month).toBe("甲寅");
    expect(r.pillars.day).toBe("庚子");
    expect(r.pillars.hour).toBe("戊子");
  });

  it("1988-02-02 22:30 → 丁卯 癸丑 丁亥 辛亥 (보정 후 22:00, 亥時 유지)", () => {
    // 입춘 이전 → 1987년(丁卯) 기준, 癸丑월(축월)
    const r = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 2,
      birthHour: 22,
      birthMinute: 30,
      gender: "male",
    });
    expect(r.pillars.year).toBe("丁卯");
    expect(r.pillars.month).toBe("癸丑");
    expect(r.pillars.day).toBe("丁亥");
    expect(r.pillars.hour).toBe("辛亥");
  });
});

// ---------------------------------------------------------------------------
// 6. 절기 경계일 테스트
// ---------------------------------------------------------------------------

describe("절기 경계일 — 입춘(立春) 전후 年月柱 변경", () => {
  it("1988-02-02(입춘 전) 년주 = 丁卯, 1988-02-15(입춘 후) 년주 = 戊辰", () => {
    const before = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 2,
      birthHour: 12,
      gender: "male",
    });
    const after = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 12,
      gender: "male",
    });
    expect(before.pillars.year).toBe("丁卯");
    expect(after.pillars.year).toBe("戊辰");
  });

  it("입춘 전은 축월(癸丑), 입춘 후는 인월(甲寅)", () => {
    const before = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 2,
      birthHour: 12,
      gender: "male",
    });
    const after = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 12,
      gender: "male",
    });
    expect(before.pillars.month).toBe("癸丑"); // 축월
    expect(after.pillars.month).toBe("甲寅"); //  인월
  });
});

// ---------------------------------------------------------------------------
// 7. 경도 보정 → 時柱 변경 확인 (-30분 항상 적용)
// ---------------------------------------------------------------------------

describe("경도 보정(-30분) → 時柱 변경 확인", () => {
  it("15:00 KST → 보정 후 14:30 → 未時 (申時에서 변경됨)", () => {
    // 미보정 시 15:00 = 申時, 보정 후 14:30 = 未時
    const r = computeSaju({
      birthYear: 2005,
      birthMonth: 6,
      birthDay: 1,
      birthHour: 15,
      birthMinute: 0,
      gender: "male",
    });
    // 지지가 未(미)여야 한다
    expect(r.pillars.hour?.charAt(1)).toBe("未");
  });

  it("14:30 KST → 보정 후 14:00 → 未時 (경계 안쪽)", () => {
    const r = computeSaju({
      birthYear: 2005,
      birthMonth: 6,
      birthDay: 1,
      birthHour: 14,
      birthMinute: 30,
      gender: "male",
    });
    expect(r.pillars.hour?.charAt(1)).toBe("未");
  });
});

// ---------------------------------------------------------------------------
// 8. 권위 만세력 교차 검증 — 점신(點神) 기준
//    보정 기준: 동경 127.5° -30분
// ---------------------------------------------------------------------------

describe("권위 만세력 교차 검증 — 점신(點神)", () => {
  it("2022-06-07 09:19 여 → 시주 壬辰 (점신 일치, 巳→辰시 보정 효과)", () => {
    // 미보정(09:19 巳時) → 癸巳. 보정 후(08:49 辰時) → 壬辰 ← 점신 결과
    const r = computeSaju({
      birthYear: 2022,
      birthMonth: 6,
      birthDay: 7,
      birthHour: 9,
      birthMinute: 19,
      gender: "female",
    });
    expect(r.pillars.hour).toBe("壬辰");
  });

  it("2022-06-07 09:19 여 → 오행 水木·火火·金木·水土 (점신 일치)", () => {
    const r = computeSaju({
      birthYear: 2022,
      birthMonth: 6,
      birthDay: 7,
      birthHour: 9,
      birthMinute: 19,
      gender: "female",
    });
    expect(r.pillars.year).toBe("壬寅");
    expect(r.pillars.month).toBe("丙午");
    expect(r.pillars.day).toBe("辛卯");
  });

  it("1983-12-25 14:17 남 → 시주 丁未 유지 (경계 아님, 보정 무관)", () => {
    // 14:17 - 30 = 13:47 → 未時. 丁未 유지
    const r = computeSaju({
      birthYear: 1983,
      birthMonth: 12,
      birthDay: 25,
      birthHour: 14,
      birthMinute: 17,
      gender: "male",
    });
    expect(r.pillars.hour).toBe("丁未");
  });

  it("2020-09-16 16:43 남 → 시주 戊申 유지 (경계 아님, 보정 무관)", () => {
    // 16:43 - 30 = 16:13 → 申時. 戊申 유지
    const r = computeSaju({
      birthYear: 2020,
      birthMonth: 9,
      birthDay: 16,
      birthHour: 16,
      birthMinute: 43,
      gender: "male",
    });
    expect(r.pillars.hour).toBe("戊申");
  });
});

// ---------------------------------------------------------------------------
// 9. 입춘 절입시각 경계 — 연주·월주는 KASI KST 절입시각 기준
//    (lunar-javascript 절기는 CST(UTC+8)이므로 -60분 어댑터 적용 후 비교.
//     진태양시 -30분 보정은 절기 비교에 적용하지 않는다.)
// ---------------------------------------------------------------------------

describe("입춘 절입시각 경계 — 2024-02-04 17:27 KST (KASI)", () => {
  const at = (hour: number, minute: number) =>
    computeSaju({
      birthYear: 2024,
      birthMonth: 2,
      birthDay: 4,
      birthHour: hour,
      birthMinute: minute,
      gender: "male",
    });

  it("입춘 37분 전(16:50) → 癸卯년 乙丑월 (전년·축월)", () => {
    const r = at(16, 50);
    expect(r.pillars.year).toBe("癸卯");
    expect(r.pillars.month).toBe("乙丑");
  });

  it("입춘 17분 전(17:10) → 癸卯년 乙丑월 (-30분 보정이 연·월주에 영향 없음)", () => {
    // 회귀 방지: 절기 비교에 -30분 보정이 끼면 17:27-30분=16:57부터
    // 새해로 잘못 넘어간다. 17:10은 반드시 입춘 전이어야 한다.
    const r = at(17, 10);
    expect(r.pillars.year).toBe("癸卯");
    expect(r.pillars.month).toBe("乙丑");
  });

  it("입춘 13분 후(17:40) → 甲辰년 丙寅월 (새해·인월)", () => {
    const r = at(17, 40);
    expect(r.pillars.year).toBe("甲辰");
    expect(r.pillars.month).toBe("丙寅");
  });

  it("입춘 경계에서 대운 방향도 같이 바뀐다 (癸卯 음남 역행 ↔ 甲辰 양남 순행)", () => {
    // 16:50(癸卯 음남): 월주 乙丑 역행 → 甲子
    // 17:40(甲辰 양남): 월주 丙寅 순행 → 丁卯
    expect(at(16, 50).daeun[0].ganji).toBe("甲子");
    expect(at(17, 40).daeun[0].ganji).toBe("丁卯");
  });
});

// ---------------------------------------------------------------------------
// 10. 자정 경계 — 일주·시주 (-30분 보정, 야자시파)
//
// 현재 동작: 일주는 보정 자정(= KST 00:30)에 바뀐다. (lunar-js sect 기본값 2)
// 23:30~00:30 KST 출생 = 야자시: 일주 당일 유지, 시주는 익일 일간 기준 子時.
//
// TODO [점신 대조 — 학파 확인]:
//   정자시(正子時)파는 23:30 KST부터 익일 일주를 쓴다.
//   판별 입력: 2024-05-10 23:40 출생 → 야자시파 일주 甲戌 / 정자시파 乙亥.
//   점신과 다르면 pillars.ts에서 ecDay.setSect(1)로 전환할 것.
// ---------------------------------------------------------------------------

describe("자정 경계 — 야자시(일주는 KST 00:30에 변경)", () => {
  const at = (day: number, hour: number, minute: number) =>
    computeSaju({
      birthYear: 2024,
      birthMonth: 5,
      birthDay: day,
      birthHour: hour,
      birthMinute: minute,
      gender: "male",
    });

  it("5/10 23:20 (보정 22:50, 亥時) → 일주 甲戌, 시주 乙亥", () => {
    const r = at(10, 23, 20);
    expect(r.pillars.day).toBe("甲戌");
    expect(r.pillars.hour).toBe("乙亥");
  });

  it("5/10 23:40 (보정 23:10, 야자시) → 일주 甲戌 유지, 시주 丙子(익일 일간 기준)", () => {
    const r = at(10, 23, 40);
    expect(r.pillars.day).toBe("甲戌");
    expect(r.pillars.hour).toBe("丙子");
  });

  it("5/11 00:10 (보정 전날 23:40, 야자시) → 일주 甲戌(전날), 시주 丙子", () => {
    const r = at(11, 0, 10);
    expect(r.pillars.day).toBe("甲戌");
    expect(r.pillars.hour).toBe("丙子");
  });

  it("5/11 00:40 (보정 00:10, 조자시) → 일주 乙亥(새 날), 시주 丙子", () => {
    const r = at(11, 0, 40);
    expect(r.pillars.day).toBe("乙亥");
    expect(r.pillars.hour).toBe("丙子");
  });

  it("야자시 구간(23:40)과 조자시 구간(00:40)의 시주는 같다 (둘 다 丙子)", () => {
    expect(at(10, 23, 40).pillars.hour).toBe(at(11, 0, 40).pillars.hour);
  });
});

// ---------------------------------------------------------------------------
// 11. 오행·십성·기질 구조 검사
// ---------------------------------------------------------------------------

describe("computeSaju — 오행·기질 구조", () => {
  const sample = () =>
    computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      birthHour: 10,
      gender: "male",
    });

  it("오행 5항목이 모두 존재한다", () => {
    const { elements } = sample();
    expect(elements).toHaveProperty("목");
    expect(elements).toHaveProperty("화");
    expect(elements).toHaveProperty("토");
    expect(elements).toHaveProperty("금");
    expect(elements).toHaveProperty("수");
  });

  it("오행 백분율 합계 ≈ 100 (부동소수점 오차 ±1% 허용)", () => {
    const { elements } = sample();
    const sum =
      elements.목 + elements.화 + elements.토 + elements.금 + elements.수;
    expect(Math.abs(sum - 100)).toBeLessThan(1);
  });

  it("기질 점수 6축이 모두 0~100 범위다", () => {
    const { traitScores } = sample();
    for (const v of Object.values(traitScores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("기질 점수에 6개 축이 있다", () => {
    const { traitScores } = sample();
    expect(Object.keys(traitScores)).toHaveLength(6);
  });

  it("대운 항목에 age와 ganji 필드가 있다", () => {
    const { daeun } = sample();
    expect(daeun.length).toBeGreaterThan(0);
    for (const d of daeun) {
      expect(typeof d.age).toBe("number");
      expect(d.age).toBeGreaterThanOrEqual(0);
      expect(typeof d.ganji).toBe("string");
      expect(d.ganji.length).toBe(2); // 干支는 2자
    }
  });

  it("대운 목록이 나이 오름차순이다", () => {
    const { daeun } = sample();
    for (let i = 1; i < daeun.length; i++) {
      expect(daeun[i].age).toBeGreaterThan(daeun[i - 1].age);
    }
  });
});
