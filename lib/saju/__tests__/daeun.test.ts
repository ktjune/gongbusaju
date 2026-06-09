/**
 * lib/saju/daeun.ts + hanzi.formatDaeunAge 테스트
 *
 * [성별 코드 주의]
 * lunar-javascript getYun(gender): 1=남(男), 0=여(女)  ← 직관과 반대
 * 이전 버그: male=0으로 넘겨 음년 남자가 순행으로 계산됨 (수정 완료)
 *
 * [대운 방향 규칙]
 * 陽男陰女 → 순행(順行), 陰男陽女 → 역행(逆行)
 * 1983 = 癸亥년, 癸=음간 → 음년 남자 → 역행
 *
 * [교차 검증 결과] 1983-12-25 14:00 남
 *   lunar-javascript (수정 후): 5년 10개월 — 사주매니아와 일치 ✓
 *   첫 대운 간지: 癸亥 (역행) ✓
 */

import { describe, it, expect } from "vitest";
import { computeSaju } from "../pillars";
import { formatDaeunAge } from "../hanzi";

// ──────────────────────────────────────────────────────────────
// 1. 역행 검증: 1983-12-25 14:00 남 — 사주매니아 교차 검증
//    癸亥년 음년 남자 → 역행 → 첫 대운 癸亥, 5년 10개월
// ──────────────────────────────────────────────────────────────

describe("대운 — 1983-12-25 14:00 남 (음년 역행, 사주매니아 교차 검증)", () => {
  const result = computeSaju({
    birthYear: 1983,
    birthMonth: 12,
    birthDay: 25,
    birthHour: 14,
    gender: "male",
  });

  it("대운이 최소 1개 이상 존재한다", () => {
    expect(result.daeun.length).toBeGreaterThan(0);
  });

  it("첫 대운 간지 = 癸亥 (역행 — 사주매니아 일치)", () => {
    expect(result.daeun[0].ganji).toBe("癸亥");
  });

  it("첫 대운 만나이(연) = 5 (사주매니아 '5년 10개월' 일치)", () => {
    expect(result.daeun[0].age).toBe(5);
  });

  it("첫 대운 추가 개월 = 10 (사주매니아 '5년 10개월' 일치)", () => {
    expect(result.daeun[0].startMonths).toBe(10);
  });

  it("두 번째 대운 만나이 = 15 (첫 대운 + 10년)", () => {
    if (result.daeun.length >= 2) {
      expect(result.daeun[1].age).toBe(15);
    }
  });

  it("세 번째 대운 만나이 = 25 (첫 대운 + 20년)", () => {
    if (result.daeun.length >= 3) {
      expect(result.daeun[2].age).toBe(25);
    }
  });

  it("모든 대운의 startMonths가 동일하다", () => {
    const months = result.daeun.map((d) => d.startMonths);
    const allSame = months.every((m) => m === months[0]);
    expect(allSame).toBe(true);
  });

  it("대운 나이는 10년 간격으로 증가한다", () => {
    for (let i = 1; i < result.daeun.length; i++) {
      expect(result.daeun[i].age - result.daeun[i - 1].age).toBe(10);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 2. 순행 스모크 테스트: 양년 남자 → 순행
//    2024 = 甲辰년, 甲=양간 → 양년 남자 → 순행
// ──────────────────────────────────────────────────────────────

describe("대운 방향 — 양년 남자 순행 스모크", () => {
  const result = computeSaju({
    birthYear: 2024,
    birthMonth: 3,
    birthDay: 15,
    birthHour: 12,
    gender: "male",
  });

  it("순행(甲辰년 남): 대운이 존재한다", () => {
    expect(result.daeun.length).toBeGreaterThan(0);
  });

  it("순행: 대운 나이는 10년 간격으로 증가한다", () => {
    for (let i = 1; i < result.daeun.length; i++) {
      expect(result.daeun[i].age - result.daeun[i - 1].age).toBe(10);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 3. formatDaeunAge 형식 검증
// ──────────────────────────────────────────────────────────────

describe("formatDaeunAge — 대운 나이 표기", () => {
  it("formatDaeunAge(5, 10) → '만 5세 10개월부터'", () => {
    expect(formatDaeunAge(5, 10)).toBe("만 5세 10개월부터");
  });

  it("formatDaeunAge(15, 0) → '만 15세부터' (개월 0 생략)", () => {
    expect(formatDaeunAge(15, 0)).toBe("만 15세부터");
  });

  it("formatDaeunAge(0, 6) → '만 0세 6개월부터'", () => {
    expect(formatDaeunAge(0, 6)).toBe("만 0세 6개월부터");
  });

  it("formatDaeunAge(3, 11) → '만 3세 11개월부터'", () => {
    expect(formatDaeunAge(3, 11)).toBe("만 3세 11개월부터");
  });

  it("'만 X세 Y개월부터' 형식 준수 (정규식)", () => {
    const result = formatDaeunAge(5, 10);
    expect(result).toMatch(/^만 \d+세 \d+개월부터$/);
  });

  it("개월 0인 경우 '만 X세부터' 형식 준수 (정규식)", () => {
    const result = formatDaeunAge(15, 0);
    expect(result).toMatch(/^만 \d+세부터$/);
  });
});
