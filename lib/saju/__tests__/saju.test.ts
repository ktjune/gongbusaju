/**
 * lib/saju 만세력 엔진 테스트 (TDD)
 *
 * [테스트 목적]
 * 이 테스트는 lunar-javascript 라이브러리 기반의 자체 일관성(internal consistency)을
 * 검증합니다. 라이브러리 내 데이터와 동일한 결과가 나오는지 확인합니다.
 *
 * TODO [외부 권위 대조]: 한국천문연구원(KASI) 또는 대한사주학회 등 권위 있는
 * 만세력과 교차 검증이 반드시 필요합니다. 이 테스트 통과 ≠ 절대 정확도 보장.
 */

import { describe, it, expect } from "vitest";
import {
  getSajuMonth,
  getTrueSolarTimeOffsetMinutes,
  applyTrueSolarTime,
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
// 2. 진태양시(眞太陽時) 보정
// ---------------------------------------------------------------------------

describe("진태양시 보정", () => {
  it("서울 기준(동경 126.97°) 오프셋 = 약 -32분", () => {
    expect(getTrueSolarTimeOffsetMinutes(126.97)).toBe(-32);
  });

  it("부산 기준(약 동경 129°) 오프셋 = -24분", () => {
    expect(getTrueSolarTimeOffsetMinutes(129)).toBe(-24);
  });

  it("표준 경도(135°) 오프셋 = 0분", () => {
    expect(getTrueSolarTimeOffsetMinutes(135)).toBe(0);
  });

  it("15:00 KST → 14:28 진태양시(시각 감소)", () => {
    const adj = applyTrueSolarTime(2000, 6, 1, 15, 0);
    expect(adj.hour).toBe(14);
    expect(adj.minute).toBe(28);
    expect(adj.day).toBe(1); // 날짜 변경 없음
  });

  it("00:10 KST → 전날 23:38 (날짜 넘김)", () => {
    // 2000년은 윤년이므로 2월 29일이 있음
    const adj = applyTrueSolarTime(2000, 3, 1, 0, 10);
    expect(adj.month).toBe(2);
    expect(adj.day).toBe(29); // 날짜가 전날로
    expect(adj.hour).toBe(23);
    expect(adj.minute).toBe(38);
  });
});

// ---------------------------------------------------------------------------
// 3. 시간 모름 케이스
// ---------------------------------------------------------------------------

describe("computeSaju — 시간 모름(birthHour 미지정)", () => {
  it("birthHour 없으면 pillars.hour = null", () => {
    const r = computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      gender: "male",
      useTrueSolarTime: false,
    });
    expect(r.pillars.hour).toBeNull();
  });

  it("시간 모름이어도 年月日 기둥은 계산된다", () => {
    const r = computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      gender: "male",
      useTrueSolarTime: false,
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
      useTrueSolarTime: false,
    });
    expect(r.daeun.length).toBeGreaterThan(0);
    expect(typeof r.daeun[0].age).toBe("number");
    expect(typeof r.daeun[0].ganji).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// 4. 알려진 만세력 픽스처 — lunar-javascript 라이브러리 기준 자체 일관성
//    (lunar-javascript __tests__/EightChar.test.js 와 동일 입력값 사용)
// ---------------------------------------------------------------------------

describe("computeSaju — 알려진 기둥값 검증 (lunar-javascript 기준)", () => {
  /**
   * TODO [외부 권위 대조]: 아래 기댓값은 lunar-javascript 라이브러리에서
   * 직접 추출한 값으로, 한국 권위 만세력과의 대조가 아직 이루어지지 않았습니다.
   */

  it("2005-12-23 08:37 → 乙酉 戊子 辛巳 壬辰", () => {
    const r = computeSaju({
      birthYear: 2005,
      birthMonth: 12,
      birthDay: 23,
      birthHour: 8,
      birthMinute: 37,
      gender: "male",
      useTrueSolarTime: false,
    });
    expect(r.pillars.year).toBe("乙酉");
    expect(r.pillars.month).toBe("戊子");
    expect(r.pillars.day).toBe("辛巳");
    expect(r.pillars.hour).toBe("壬辰");
  });

  it("1988-02-15 23:30 → 戊辰 甲寅 庚子 戊子 (입춘 이후 인월)", () => {
    // 입춘(1988-02-04 경) 이후 → 戊辰년, 甲寅월(인월)
    const r = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 23,
      birthMinute: 30,
      gender: "male",
      useTrueSolarTime: false,
    });
    expect(r.pillars.year).toBe("戊辰");
    expect(r.pillars.month).toBe("甲寅");
    expect(r.pillars.day).toBe("庚子");
    expect(r.pillars.hour).toBe("戊子");
  });

  it("1988-02-02 22:30 → 丁卯 癸丑 丁亥 辛亥 (입춘 이전 축월, 前年 丁卯)", () => {
    // 입춘 이전 → 1987년(丁卯) 기준, 癸丑월(축월)
    const r = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 2,
      birthHour: 22,
      birthMinute: 30,
      gender: "male",
      useTrueSolarTime: false,
    });
    expect(r.pillars.year).toBe("丁卯");
    expect(r.pillars.month).toBe("癸丑");
    expect(r.pillars.day).toBe("丁亥");
    expect(r.pillars.hour).toBe("辛亥");
  });
});

// ---------------------------------------------------------------------------
// 5. 절기 경계일 테스트
// ---------------------------------------------------------------------------

describe("절기 경계일 — 입춘(立春) 전후 年月柱 변경", () => {
  it("1988-02-02(입춘 전) 년주 = 丁卯, 1988-02-15(입춘 후) 년주 = 戊辰", () => {
    const before = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 2,
      birthHour: 12,
      gender: "male",
      useTrueSolarTime: false,
    });
    const after = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 12,
      gender: "male",
      useTrueSolarTime: false,
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
      useTrueSolarTime: false,
    });
    const after = computeSaju({
      birthYear: 1988,
      birthMonth: 2,
      birthDay: 15,
      birthHour: 12,
      gender: "male",
      useTrueSolarTime: false,
    });
    expect(before.pillars.month).toBe("癸丑"); // 축월
    expect(after.pillars.month).toBe("甲寅"); //  인월
  });
});

// ---------------------------------------------------------------------------
// 6. 진태양시 보정 → 時柱 변경 확인
// ---------------------------------------------------------------------------

describe("진태양시 보정 → 時柱 변경", () => {
  it("15:00 KST 미보정 → 申時, 보정 후(14:28) → 未時로 달라진다", () => {
    const withoutAdj = computeSaju({
      birthYear: 2005,
      birthMonth: 6,
      birthDay: 1,
      birthHour: 15,
      birthMinute: 0,
      gender: "male",
      useTrueSolarTime: false,
    });
    const withAdj = computeSaju({
      birthYear: 2005,
      birthMonth: 6,
      birthDay: 1,
      birthHour: 15,
      birthMinute: 0,
      gender: "male",
      useTrueSolarTime: true,
    });
    // 15:00 → 申時(申), 14:28 → 未時(未) — 地支가 달라지므로 기둥이 달라짐
    expect(withAdj.pillars.hour).not.toBe(withoutAdj.pillars.hour);
  });
});

// ---------------------------------------------------------------------------
// 7. 오행·십성·기질 구조 검사
// ---------------------------------------------------------------------------

describe("computeSaju — 오행·기질 구조", () => {
  const sample = () =>
    computeSaju({
      birthYear: 1990,
      birthMonth: 5,
      birthDay: 1,
      birthHour: 10,
      gender: "male",
      useTrueSolarTime: false,
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
