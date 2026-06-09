/**
 * lib/saju/hanzi.ts 유틸 테스트
 *
 * 한자↔한글 매핑 정확성 + 나이 변환 로직 검증.
 * 재사용 가능한 유틸이므로 모든 공개 함수를 커버한다.
 */

import { describe, it, expect } from "vitest";
import {
  TIANGAN_KR,
  DIZHI_KR,
  WUXING_KR,
  SHISHEN_KR,
  ganjiToHangul,
  withHangul,
  wuxingToHangul,
  wuxingWithHangul,
  tenGodToHangul,
  tenGodWithHangul,
  seToMannai,
  formatMannai,
} from "../hanzi";

// ──────────────────────────────────────────────────────────────
// 1. 매핑 테이블 완결성
// ──────────────────────────────────────────────────────────────

describe("매핑 테이블 완결성", () => {
  it("天干 10개 전부 매핑됨", () => {
    const tiangan = "甲乙丙丁戊己庚辛壬癸";
    for (const c of tiangan) {
      expect(TIANGAN_KR[c]).toBeTruthy();
    }
    expect(Object.keys(TIANGAN_KR)).toHaveLength(10);
  });

  it("地支 12개 전부 매핑됨", () => {
    const dizhi = "子丑寅卯辰巳午未申酉戌亥";
    for (const c of dizhi) {
      expect(DIZHI_KR[c]).toBeTruthy();
    }
    expect(Object.keys(DIZHI_KR)).toHaveLength(12);
  });

  it("五行 5개 전부 매핑됨", () => {
    for (const c of ["木", "火", "土", "金", "水"]) {
      expect(WUXING_KR[c]).toBeTruthy();
    }
  });

  it("十神 간체(简体) 10개 전부 매핑됨", () => {
    const shishen = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];
    for (const s of shishen) {
      expect(SHISHEN_KR[s]).toBeTruthy();
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 2. 天干 개별 확인
// ──────────────────────────────────────────────────────────────

describe("TIANGAN_KR — 天干 10개 정확성", () => {
  const cases: [string, string][] = [
    ["甲", "갑"], ["乙", "을"], ["丙", "병"], ["丁", "정"], ["戊", "무"],
    ["己", "기"], ["庚", "경"], ["辛", "신"], ["壬", "임"], ["癸", "계"],
  ];
  for (const [hanja, hangul] of cases) {
    it(`${hanja} → ${hangul}`, () => {
      expect(TIANGAN_KR[hanja]).toBe(hangul);
    });
  }
});

// ──────────────────────────────────────────────────────────────
// 3. 地支 개별 확인
// ──────────────────────────────────────────────────────────────

describe("DIZHI_KR — 地支 12개 정확성", () => {
  const cases: [string, string][] = [
    ["子", "자"], ["丑", "축"], ["寅", "인"], ["卯", "묘"],
    ["辰", "진"], ["巳", "사"], ["午", "오"], ["未", "미"],
    ["申", "신"], ["酉", "유"], ["戌", "술"], ["亥", "해"],
  ];
  for (const [hanja, hangul] of cases) {
    it(`${hanja} → ${hangul}`, () => {
      expect(DIZHI_KR[hanja]).toBe(hangul);
    });
  }
});

// ──────────────────────────────────────────────────────────────
// 4. ganjiToHangul
// ──────────────────────────────────────────────────────────────

describe("ganjiToHangul — 간지 한글 독음", () => {
  it("甲子 → 갑자", () => expect(ganjiToHangul("甲子")).toBe("갑자"));
  it("乙丑 → 을축", () => expect(ganjiToHangul("乙丑")).toBe("을축"));
  it("丙寅 → 병인", () => expect(ganjiToHangul("丙寅")).toBe("병인"));
  it("丁卯 → 정묘", () => expect(ganjiToHangul("丁卯")).toBe("정묘"));
  it("戊辰 → 무진", () => expect(ganjiToHangul("戊辰")).toBe("무진"));
  it("己巳 → 기사", () => expect(ganjiToHangul("己巳")).toBe("기사"));
  it("庚午 → 경오", () => expect(ganjiToHangul("庚午")).toBe("경오"));
  it("辛未 → 신미", () => expect(ganjiToHangul("辛未")).toBe("신미"));
  it("壬申 → 임신", () => expect(ganjiToHangul("壬申")).toBe("임신"));
  it("癸亥 → 계해", () => expect(ganjiToHangul("癸亥")).toBe("계해"));
  it("甲申(자주 출현) → 갑신", () => expect(ganjiToHangul("甲申")).toBe("갑신"));
  it("庚子(경자년) → 경자", () => expect(ganjiToHangul("庚子")).toBe("경자"));
});

// ──────────────────────────────────────────────────────────────
// 5. withHangul
// ──────────────────────────────────────────────────────────────

describe("withHangul — 한자(한글) 형식", () => {
  it('甲子 → "甲子(갑자)"', () => expect(withHangul("甲子")).toBe("甲子(갑자)"));
  it('乙丑 → "乙丑(을축)"', () => expect(withHangul("乙丑")).toBe("乙丑(을축)"));
  it('壬申 → "壬申(임신)"', () => expect(withHangul("壬申")).toBe("壬申(임신)"));
  it('癸亥 → "癸亥(계해)"', () => expect(withHangul("癸亥")).toBe("癸亥(계해)"));
  it("알 수 없는 글자 → 원본 반환", () => {
    // 인식 못 하는 한자는 원본 그대로
    expect(withHangul("??")).toBe("??");
  });
});

// ──────────────────────────────────────────────────────────────
// 6. 오행 함수
// ──────────────────────────────────────────────────────────────

describe("wuxingToHangul / wuxingWithHangul", () => {
  it("木 → 목", () => expect(wuxingToHangul("木")).toBe("목"));
  it("火 → 화", () => expect(wuxingToHangul("火")).toBe("화"));
  it("土 → 토", () => expect(wuxingToHangul("土")).toBe("토"));
  it("金 → 금", () => expect(wuxingToHangul("金")).toBe("금"));
  it("水 → 수", () => expect(wuxingToHangul("水")).toBe("수"));

  it('木 withHangul → "木(목)"', () => expect(wuxingWithHangul("木")).toBe("木(목)"));
  it('水 withHangul → "水(수)"', () => expect(wuxingWithHangul("水")).toBe("水(수)"));
});

// ──────────────────────────────────────────────────────────────
// 7. 십성 함수 — lunar-javascript 간체 기준
// ──────────────────────────────────────────────────────────────

describe("tenGodToHangul / tenGodWithHangul — 간체(简体) 십성", () => {
  const cases: [string, string][] = [
    ["比肩", "비견"],
    ["劫财", "겁재"],   // 간체 財→财
    ["食神", "식신"],
    ["伤官", "상관"],   // 간체 傷→伤
    ["偏财", "편재"],   // 간체 財→财
    ["正财", "정재"],   // 간체 財→财
    ["七杀", "칠살"],   // 간체 殺→杀
    ["正官", "정관"],
    ["偏印", "편인"],
    ["正印", "정인"],
  ];

  for (const [hanja, hangul] of cases) {
    it(`tenGodToHangul("${hanja}") → "${hangul}"`, () => {
      expect(tenGodToHangul(hanja)).toBe(hangul);
    });
    it(`tenGodWithHangul("${hanja}") → "${hanja}(${hangul})"`, () => {
      expect(tenGodWithHangul(hanja)).toBe(`${hanja}(${hangul})`);
    });
  }

  it("전통체(繁體) 劫財도 매핑됨", () => {
    expect(tenGodToHangul("劫財")).toBe("겁재");
  });

  it("전통체 七殺도 매핑됨", () => {
    expect(tenGodToHangul("七殺")).toBe("칠살");
  });

  it("알 수 없는 십성 → 원본 반환", () => {
    expect(tenGodToHangul("알수없음")).toBe("알수없음");
    expect(tenGodWithHangul("알수없음")).toBe("알수없음");
  });
});

// ──────────────────────────────────────────────────────────────
// 8. 나이 변환 — seToMannai / formatMannai
// ──────────────────────────────────────────────────────────────

describe("seToMannai — 세는나이 → 만나이 변환", () => {
  it("세는나이 1세 → 만 0세 (출생년도)", () => {
    expect(seToMannai(1)).toBe(0);
  });

  it("세는나이 6세 → 만 5세", () => {
    expect(seToMannai(6)).toBe(5);
  });

  it("세는나이 11세 → 만 10세", () => {
    expect(seToMannai(11)).toBe(10);
  });

  it("세는나이 21세 → 만 20세", () => {
    expect(seToMannai(21)).toBe(20);
  });

  it("세는나이 0 이하 → 0 (음수 방지)", () => {
    expect(seToMannai(0)).toBe(0);
    expect(seToMannai(-1)).toBe(0);
  });
});

describe("formatMannai — '만 X세' 형식", () => {
  it("세는나이 6 → '만 5세'", () => {
    expect(formatMannai(6)).toBe("만 5세");
  });

  it("세는나이 11 → '만 10세'", () => {
    expect(formatMannai(11)).toBe("만 10세");
  });

  it("세는나이 1 → '만 0세'", () => {
    expect(formatMannai(1)).toBe("만 0세");
  });

  it("세는나이 21 → '만 20세'", () => {
    expect(formatMannai(21)).toBe("만 20세");
  });

  it("'만 X세' 형식 준수 (정규식 검사)", () => {
    const result = formatMannai(8);
    expect(result).toMatch(/^만 \d+세$/);
  });
});
