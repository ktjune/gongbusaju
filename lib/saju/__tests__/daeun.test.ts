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
// 3. 대운 방향 4조합 — 60갑자 수학 검증
//    첫 대운은 월주에서 출발한다:
//      순행(陽男陰女) = 월주 다음 간지, 역행(陰男陽女) = 월주 이전 간지
// ──────────────────────────────────────────────────────────────

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
/** 60갑자 순환표 (甲子 → 乙丑 → … → 癸亥) */
const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);

const nextGanji = (g: string) => JIAZI[(JIAZI.indexOf(g) + 1) % 60];
const prevGanji = (g: string) => JIAZI[(JIAZI.indexOf(g) + 59) % 60];

describe("대운 방향 4조합 — 첫 대운 = 월주 ±1 (60갑자 검증)", () => {
  it("양남 순행: 2020-09-16 16:43 남 (庚子년) → 월주 乙酉 다음 丙戌", () => {
    const r = computeSaju({
      birthYear: 2020, birthMonth: 9, birthDay: 16,
      birthHour: 16, birthMinute: 43, gender: "male",
    });
    expect(r.pillars.month).toBe("乙酉");
    expect(r.daeun[0].ganji).toBe(nextGanji(r.pillars.month)); // 丙戌
  });

  it("음남 역행: 1983-12-25 14:17 남 (癸亥년) → 월주 甲子 이전 癸亥", () => {
    const r = computeSaju({
      birthYear: 1983, birthMonth: 12, birthDay: 25,
      birthHour: 14, birthMinute: 17, gender: "male",
    });
    expect(r.pillars.month).toBe("甲子");
    expect(r.daeun[0].ganji).toBe(prevGanji(r.pillars.month)); // 癸亥
  });

  it("양녀 역행: 2022-06-07 09:19 여 (壬寅년) → 월주 丙午 이전 乙巳", () => {
    const r = computeSaju({
      birthYear: 2022, birthMonth: 6, birthDay: 7,
      birthHour: 9, birthMinute: 19, gender: "female",
    });
    expect(r.pillars.month).toBe("丙午");
    expect(r.daeun[0].ganji).toBe(prevGanji(r.pillars.month)); // 乙巳
  });

  it("음녀 순행: 1985-06-15 10:00 여 (乙丑년) → 월주 壬午 다음 癸未", () => {
    const r = computeSaju({
      birthYear: 1985, birthMonth: 6, birthDay: 15,
      birthHour: 10, birthMinute: 0, gender: "female",
    });
    expect(r.pillars.month).toBe("壬午");
    expect(r.daeun[0].ganji).toBe(nextGanji(r.pillars.month)); // 癸未
  });

  it("연속성: 대운 목록 전체가 같은 방향으로 1칸씩 진행한다 (2022 여 역행)", () => {
    const r = computeSaju({
      birthYear: 2022, birthMonth: 6, birthDay: 7,
      birthHour: 9, birthMinute: 19, gender: "female",
    });
    for (let i = 1; i < r.daeun.length; i++) {
      expect(r.daeun[i].ganji).toBe(prevGanji(r.daeun[i - 1].ganji));
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 4. 점신 교차검증 픽스처 — 대운 시작 나이
// ──────────────────────────────────────────────────────────────

describe("대운 시작 나이 — 점신 교차검증 픽스처", () => {
  it("2022-06-07 09:19 여 → 첫 대운 乙巳, 만 0세 5개월 (역행 — 점신 일치 케이스 고정)", () => {
    const r = computeSaju({
      birthYear: 2022, birthMonth: 6, birthDay: 7,
      birthHour: 9, birthMinute: 19, gender: "female",
    });
    expect(r.daeun[0].ganji).toBe("乙巳");
    expect(r.daeun[0].age).toBe(0);
    expect(r.daeun[0].startMonths).toBe(5);
  });

  it("2020-09-16 16:43 남 → 첫 대운 丙戌, 만 7세 (점신 '7세' 일치)", () => {
    const r = computeSaju({
      birthYear: 2020, birthMonth: 9, birthDay: 16,
      birthHour: 16, birthMinute: 43, gender: "male",
    });
    expect(r.daeun[0].ganji).toBe("丙戌");
    expect(r.daeun[0].age).toBe(7);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. formatDaeunAge 형식 검증
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
