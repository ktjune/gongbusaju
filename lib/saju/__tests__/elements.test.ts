/**
 * lib/saju/elements.ts 테스트 — 자체 환산표 기반 오행·십성
 *
 * [십성 집계 방식 — 본기(本氣) 위주, 점신식]
 * 지지는 지장간 전체가 아니라 본기 천간 1개로만 환산한다.
 * 시주 포함 시 십성 합계 = 7 (천간 3 + 지지 4, 일간 제외),
 * 시주 없으면 5 (천간 2 + 지지 3).
 *
 * 기댓값은 십성 환산 규칙으로 손계산한 값이다 (라이브러리 복사 아님).
 */

import { describe, it, expect } from "vitest";
import { computeElements, computeTenGods, tenGodOf } from "../elements";

// ──────────────────────────────────────────────────────────────
// 1. tenGodOf — 십성 결정 규칙 (일간 甲 기준 10천간 전체)
// ──────────────────────────────────────────────────────────────

describe("tenGodOf — 일간 甲(木+) 기준 10천간", () => {
  const cases: Array<[string, string]> = [
    ["甲", "比肩"], // 같은 오행, 같은 음양
    ["乙", "劫财"], // 같은 오행, 다른 음양
    ["丙", "食神"], // 木生火, 같은 음양
    ["丁", "伤官"], // 木生火, 다른 음양
    ["戊", "偏财"], // 木剋土, 같은 음양
    ["己", "正财"], // 木剋土, 다른 음양
    ["庚", "七杀"], // 金剋木, 같은 음양
    ["辛", "正官"], // 金剋木, 다른 음양
    ["壬", "偏印"], // 水生木, 같은 음양
    ["癸", "正印"], // 水生木, 다른 음양
  ];

  for (const [stem, expected] of cases) {
    it(`甲 일간 vs ${stem} → ${expected}`, () => {
      expect(tenGodOf("甲", stem)).toBe(expected);
    });
  }
});

describe("tenGodOf — 음간 일간(辛, 金−) 음양 대칭 확인", () => {
  it("辛 vs 丁(火−) → 七杀 (火剋金, 같은 음양)", () => {
    expect(tenGodOf("辛", "丁")).toBe("七杀");
  });

  it("辛 vs 丙(火+) → 正官 (火剋金, 다른 음양)", () => {
    expect(tenGodOf("辛", "丙")).toBe("正官");
  });

  it("辛 vs 壬(水+) → 伤官 (金生水, 다른 음양)", () => {
    expect(tenGodOf("辛", "壬")).toBe("伤官");
  });

  it("辛 vs 戊(土+) → 正印 (土生金, 다른 음양)", () => {
    expect(tenGodOf("辛", "戊")).toBe("正印");
  });

  it("알 수 없는 천간 → 에러", () => {
    expect(() => tenGodOf("X", "甲")).toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
// 2. computeTenGods — 본기 위주 집계 (점신 교차검증 케이스)
// ──────────────────────────────────────────────────────────────

describe("computeTenGods — 본기 위주(점신식) 집계", () => {
  it("2022-06-07 09:19 여 (壬寅 丙午 辛卯 壬辰, 일간 辛) — 손계산 일치", () => {
    // 년간 壬(水+): 金生水 다른 음양 → 伤官
    // 년지 寅 본기 甲(木+): 金剋木 다른 음양 → 正财
    // 월간 丙(火+): 火剋金 다른 음양 → 正官
    // 월지 午 본기 丁(火−): 火剋金 같은 음양 → 七杀
    // 일지 卯 본기 乙(木−): 같은 음양 → 偏财
    // 시간 壬: 伤官
    // 시지 辰 본기 戊(土+): 土生金 다른 음양 → 正印
    const tenGods = computeTenGods({
      year: "壬寅",
      month: "丙午",
      day: "辛卯",
      hour: "壬辰",
    });
    expect(tenGods).toEqual({
      伤官: 2,
      正财: 1,
      正官: 1,
      七杀: 1,
      偏财: 1,
      正印: 1,
    });
  });

  it("1983-12-25 14:17 남 (癸亥 甲子 丁亥 丁未, 일간 丁) — 손계산 일치", () => {
    // 년간 癸(水−): 水剋火 같은 음양 → 七杀 / 년지 亥 본기 壬(水+): 다른 음양 → 正官
    // 월간 甲(木+): 木生火 다른 음양 → 正印 / 월지 子 본기 癸: → 七杀
    // 일지 亥 본기 壬: → 正官
    // 시간 丁: → 比肩 / 시지 未 본기 己(土−): 火生土 같은 음양 → 食神
    const tenGods = computeTenGods({
      year: "癸亥",
      month: "甲子",
      day: "丁亥",
      hour: "丁未",
    });
    expect(tenGods).toEqual({
      七杀: 2,
      正官: 2,
      正印: 1,
      比肩: 1,
      食神: 1,
    });
  });

  it("시주 포함 시 십성 합계 = 7 (천간 3 + 지지 본기 4)", () => {
    const tenGods = computeTenGods({
      year: "壬寅",
      month: "丙午",
      day: "辛卯",
      hour: "壬辰",
    });
    const total = Object.values(tenGods).reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
  });

  it("시주 null 시 십성 합계 = 5 (천간 2 + 지지 본기 3)", () => {
    const tenGods = computeTenGods({
      year: "壬寅",
      month: "丙午",
      day: "辛卯",
      hour: null,
    });
    const total = Object.values(tenGods).reduce((a, b) => a + b, 0);
    expect(total).toBe(5);
  });

  it("일간은 집계에서 제외된다 (일주 간지가 다른 기둥과 같아도)", () => {
    // 년주=일주=甲子: 년간 甲은 집계(比肩), 일간 甲은 제외
    // 월주 丙午: 월간 丙→食神, 월지 午 본기 丁→伤官 (比肩에 영향 없음)
    const tenGods = computeTenGods({
      year: "甲子",
      month: "丙午",
      day: "甲子",
      hour: null,
    });
    // 년간 甲 → 比肩 1개만 (일간 제외 확인)
    expect(tenGods["比肩"]).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. computeElements — 글자 단위 오행 분포
// ──────────────────────────────────────────────────────────────

describe("computeElements — 오행 분포%", () => {
  it("2022-06-07 여 (壬寅 丙午 辛卯 壬辰 = 水木·火火·金木·水土) — 점신 일치", () => {
    const e = computeElements({
      year: "壬寅",
      month: "丙午",
      day: "辛卯",
      hour: "壬辰",
    });
    // 8글자: 水2(壬壬) 木2(寅卯) 火2(丙午) 金1(辛) 土1(辰)
    expect(e.수).toBeCloseTo(25);
    expect(e.목).toBeCloseTo(25);
    expect(e.화).toBeCloseTo(25);
    expect(e.금).toBeCloseTo(12.5);
    expect(e.토).toBeCloseTo(12.5);
  });

  it("시주 null이면 6글자 기준으로 합계 100", () => {
    const e = computeElements({
      year: "壬寅",
      month: "丙午",
      day: "辛卯",
      hour: null,
    });
    const sum = e.목 + e.화 + e.토 + e.금 + e.수;
    expect(sum).toBeCloseTo(100);
  });
});
