/**
 * lib/report 테스트
 *
 * 1. guardrails 단위 테스트 — 금지 표현 차단
 * 2. 합성 테스트 (mock LLM) — 학교 사실이 코드에서 삽입되고 LLM이 못 바꾸는지
 * 3. 통합 테스트 — 실제 Claude API (ANTHROPIC_API_KEY 없으면 skip)
 *
 * [핵심 불변 조건]
 * - 학교명·거리·배정라벨은 코드(buildFactBlock)가 삽입. mock LLM이 언급 안 해도 리포트에 있다.
 * - LLM 출력에 금지 표현이 있으면 GuardrailError가 발행을 차단한다.
 */

import { describe, it, expect } from "vitest";
import type { SajuResult } from "../../saju";
import type { SchoolFacts } from "../../schools";
import {
  checkGuardrails,
  passesGuardrails,
  GuardrailError,
  buildFactBlock,
  assembleReport,
  TIME_STANDARD_NOTICE,
  ASSIGNED_SCHOOL_LABEL,
  generateReport,
  renderReportHtml,
} from "../index";
import type { LlmProvider } from "../index";

// ──────────────────────────────────────────────────────────────
// 테스트 픽스처
// ──────────────────────────────────────────────────────────────

const sampleSaju: SajuResult = {
  pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "庚申" },
  elements: { 목: 20, 화: 25, 토: 30, 금: 15, 수: 10 },
  tenGods: { 비견: 2, 겁재: 1, 식신: 3, 상관: 1, 편재: 2, 정재: 1, 편관: 1, 정관: 1, 편인: 1, 정인: 2 },
  daeun: [
    { age: 8, startMonths: 6, ganji: "丁卯" },
    { age: 18, startMonths: 6, ganji: "戊辰" },
    { age: 28, startMonths: 6, ganji: "己巳" },
  ],
  traitScores: { 집중력: 70, 창의성: 60, 사교성: 50, 리더십: 65, 인내력: 75, 직관력: 55 },
};

const sampleSchools: SchoolFacts = {
  assignedSchool: {
    schoolId: "B100000148",
    name: "청운초등학교",
    type: "초등학교",
    address: "서울특별시 종로구 자하문로 91",
    lat: 37.584045,
    lng: 126.963211,
    distanceM: 320,
    source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148)",
    asOf: "2024-03-01",
    assignedLabel: "예상 배정(교육청 확인 필요)",
  },
  cluster: [
    {
      schoolId: "B100000148",
      name: "청운초등학교",
      type: "초등학교",
      address: "서울특별시 종로구 자하문로 91",
      lat: 37.584045,
      lng: 126.963211,
      distanceM: 320,
      source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148)",
      asOf: "2024-03-01",
    },
    {
      schoolId: "B100000302",
      name: "종로중학교",
      type: "중학교",
      address: "서울특별시 종로구 사직로9길 23",
      lat: 37.57732,
      lng: 126.97015,
      distanceM: 780,
      source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148)",
      asOf: "2024-03-01",
    },
  ],
  source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148)",
  asOf: "2024-03-01",
};

/** 정상 관점 산문 픽스처 — 모든 필드 (guardrails 통과 문구) */
const samplePerspective = {
  dayMasterProse:
    "일간 무토(戊土)는 너른 산의 흙으로, 듬직하고 한결같은 결로 해석됩니다. " +
    "익숙한 일과를 좋아하고 약속을 지키려는 모습으로 드러나는 경향이 있습니다.",
  elementsProse:
    "토 기운이 강한 경향이 있어 꾸준하고 성실한 학습 스타일을 보일 수 있습니다. " +
    "수 기운이 옅은 편이라 곱씹어 정리하는 활동을 곁들이면 균형에 참고가 됩니다.",
  tenGodsProse:
    "식신(食神)이 두드러져 좋아하는 것을 파고들며 즐겁게 배우는 마음의 습관으로 풀이됩니다.",
  studyAreasProse:
    "**집중** 익숙한 자리에서 오래 머무는 힘이 좋은 경향입니다. **암기** 반복으로 단단해지는 " +
    "유형으로 풀이됩니다. **이해** 구체적 예시가 있을 때 빠른 경향입니다. **표현** 준비 시간이 " +
    "있으면 안정적입니다. **협동** 역할이 분명할 때 힘을 내는 경향입니다.",
  subjectTendencyProse:
    "토 기운이 강해 꾸준함이 필요한 영역에서 강점을 보이는 경향이 있습니다. " +
    "이는 적성의 단정이 아니라 접근 방식의 참고로 활용해 주세요.",
  studyStyleProse:
    "꾸준한 반복과 명확한 목표가 있는 학습 방식이 잘 맞는 경향이 있습니다. " +
    "화 기운도 적절히 있어 발표·표현 활동에서 에너지를 발휘하는 경향이 있습니다. " +
    "참고로 이는 해석적 관점이며 측정 결과가 아닙니다.",
  parentingProse:
    "아이가 머뭇거릴 때는 작은 단계로 나눠 주세요. 결과보다 과정을 짚어 칭찬해 주세요. " +
    "하루 일과를 같이 정하면 안정감을 얻는 경향이 있습니다.",
  stageProse:
    "지금 단계에서는 짧은 루틴으로 완료 경험을 쌓는 것이 이 아이 기질에 잘 맞는 " +
    "접근으로 풀이됩니다. 새 환경 적응에는 준비 시간을 넉넉히 주세요.",
  daeunProse:
    "현재 대운(丁卯 구간)은 활동적 에너지가 높아지는 시기로 해석됩니다. " +
    "이 시기에는 다양한 경험을 쌓는 방향이 기질 발현에 도움이 될 수 있습니다.",
  annualProse:
    "다가오는 해는 새로운 환경에 적응하는 기운으로 풀이되어, 변화 앞에서 준비 시간을 " +
    "넉넉히 주는 것이 참고가 됩니다. 그다음 해는 쌓은 것을 다지는 흐름으로 해석됩니다.",
  schoolConnectionProse:
    "토 기운이 강한 아이는 안정적이고 체계적인 환경에서 기질이 잘 발현되는 경향이 있습니다. " +
    "이는 참고 경향이며, 실제 학교 선택은 다양한 요소를 종합해 판단하시기 바랍니다.",
};

/** 정상 관점 산문을 반환하는 mock LLM */
function makeMockProvider(overrides?: Partial<typeof samplePerspective>): LlmProvider {
  return {
    async complete(_sys, _user) {
      return JSON.stringify({ ...samplePerspective, ...overrides });
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 1. guardrails 단위 테스트
// ──────────────────────────────────────────────────────────────

describe("checkGuardrails — 금지 표현 차단", () => {
  // ── 차단돼야 하는 표현 ─────────────────────────────────────

  it('"보장" → GuardrailError', () => {
    expect(() => checkGuardrails("이 결과를 보장합니다.")).toThrow(GuardrailError);
  });

  it('"틀림없이" → GuardrailError', () => {
    expect(() => checkGuardrails("틀림없이 좋은 결과가 있을 것입니다.")).toThrow(GuardrailError);
  });

  it('"반드시 이 학교" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("반드시 이 학교에 보내시기 바랍니다.")
    ).toThrow(GuardrailError);
  });

  it('"이 학교 가면 됩니다" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("이 학교 가면 됩니다.")
    ).toThrow(GuardrailError);
  });

  it('"이 학교 가면 된다" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("사주가 좋으니 이 학교 가면 된다.")
    ).toThrow(GuardrailError);
  });

  it('"이 학교에 가야 합니다" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("이 학교에 가야 합니다.")
    ).toThrow(GuardrailError);
  });

  it('"이 학교가 정답" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("이 학교가 정답입니다.")
    ).toThrow(GuardrailError);
  });

  it('"해당 학교가 정답" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("해당 학교가 정답이에요.")
    ).toThrow(GuardrailError);
  });

  it('"확실히 해당 학교" → GuardrailError', () => {
    expect(() =>
      checkGuardrails("확실히 해당 학교가 맞습니다.")
    ).toThrow(GuardrailError);
  });

  it('"사주 → 학교 → 정답" 인과 → GuardrailError', () => {
    expect(() =>
      checkGuardrails("이 사주이니 이 학교가 정답입니다.")
    ).toThrow(GuardrailError);
  });

  it('"오행 → 학교 → 최적" 인과 → GuardrailError', () => {
    expect(() =>
      checkGuardrails("오행이 토 위주이기 때문에 이 학교가 최적입니다.")
    ).toThrow(GuardrailError);
  });

  // ── 통과해야 하는 표현 ─────────────────────────────────────

  it("일반 기질 해석 텍스트 → 통과", () => {
    expect(() =>
      checkGuardrails(
        "이 아이는 토 기운이 강한 경향이 있어 꾸준한 학습 스타일을 보일 수 있습니다. " +
          "참고로 이는 해석적 관점입니다."
      )
    ).not.toThrow();
  });

  it('"학교" 단어 포함 일반 문장 → 통과', () => {
    expect(() =>
      checkGuardrails(
        "학교 환경 선택 시 이 아이의 활동적 기질을 고려하면 도움이 될 수 있습니다."
      )
    ).not.toThrow();
  });

  it('"경향", "참고", "해석" 허용 표현 → 통과', () => {
    expect(() =>
      checkGuardrails(
        "이 경향은 참고용 해석이며, 실제 선택은 보호자분이 판단하시기 바랍니다."
      )
    ).not.toThrow();
  });

  it("GuardrailError에 violations 배열 포함", () => {
    let caught: GuardrailError | null = null;
    try {
      checkGuardrails("이 결과를 보장합니다. 이 학교 가면 됩니다.");
    } catch (e) {
      caught = e as GuardrailError;
    }
    expect(caught).toBeInstanceOf(GuardrailError);
    expect(caught!.violations.length).toBeGreaterThanOrEqual(2);
    expect(caught!.violations[0]).toHaveProperty("reason");
    expect(caught!.violations[0]).toHaveProperty("matched");
  });
});

describe("passesGuardrails — bool 버전", () => {
  it("금지 표현 → false", () => {
    expect(passesGuardrails("이 학교가 정답입니다.")).toBe(false);
  });

  it("정상 텍스트 → true", () => {
    expect(passesGuardrails("기질 해석 참고용입니다.")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. buildFactBlock — 사실 블록 코드 생성 검증
// ──────────────────────────────────────────────────────────────

describe("buildFactBlock — 코드가 학교 사실 생성", () => {
  it("배정 학교명이 사실 블록에 포함됨", () => {
    const block = buildFactBlock(sampleSchools);
    expect(block.assignedSchoolSection).toContain("청운초등학교");
  });

  it("ASSIGNED_SCHOOL_LABEL이 사실 블록에 포함됨", () => {
    const block = buildFactBlock(sampleSchools);
    expect(block.assignedSchoolSection).toContain(ASSIGNED_SCHOOL_LABEL);
  });

  it("출처와 기준일이 사실 블록에 포함됨", () => {
    const block = buildFactBlock(sampleSchools);
    expect(block.assignedSchoolSection).toContain("2024-03-01");
    expect(block.assignedSchoolSection).toContain("data.go.kr");
  });

  it("cluster 섹션에 학교 목록 포함", () => {
    const block = buildFactBlock(sampleSchools);
    expect(block.clusterSection).toContain("청운초등학교");
    expect(block.clusterSection).toContain("종로중학교");
  });

  it("schools 없으면 빈 FactBlock", () => {
    const emptySchools: SchoolFacts = {
      cluster: [],
      source: "테스트",
      asOf: "2024-01-01",
    };
    const block = buildFactBlock(emptySchools);
    expect(block.assignedSchoolSection).toBeUndefined();
    expect(block.clusterSection).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────
// 3. assembleReport — 블록 조립 검증
// ──────────────────────────────────────────────────────────────

describe("assembleReport — 블록 조립", () => {
  it("TIME_STANDARD_NOTICE 항상 포함", () => {
    const md = assembleReport(sampleSaju, {}, samplePerspective);
    expect(md).toContain(TIME_STANDARD_NOTICE);
    expect(md).toContain("동경 127.5°");
  });

  it("관점 블록 섹션이 모두 포함된다", () => {
    const md = assembleReport(sampleSaju, {}, samplePerspective);
    expect(md).toContain("타고난 결 — 일간 이야기");
    expect(md).toContain("오행 에너지 분포");
    expect(md).toContain("십성 구조");
    expect(md).toContain("공부 스타일과 학습 환경");
    expect(md).toContain("부모님을 위한 코칭 포인트");
    expect(md).toContain("학령기 대운 흐름");
  });

  it("데이터 섹션(원국 표·오행 표·대운 표)이 코드로 생성된다", () => {
    const md = assembleReport(sampleSaju, {}, samplePerspective);
    // 원국 표: 일간 강조 + 한자·한글 병기
    expect(md).toContain("사주 원국");
    expect(md).toContain("← 일간");
    expect(md).toContain("甲(갑)"); // 년간
    // 오행 표: 비율 + 막대
    expect(md).toContain("木(목)");
    expect(md).toContain("%");
    // 대운 표: 만나이 + 학령기 라벨
    expect(md).toContain("만 8세 6개월");
    expect(md).toContain("초등");
    // 기질 지표 표 + 면책
    expect(md).toContain("집중력");
    expect(md).toContain("해석 지표");
  });

  it("schoolConnectionProse 있으면 기질 관점 섹션 포함", () => {
    const md = assembleReport(sampleSaju, {}, samplePerspective);
    expect(md).toContain("학교 선택 기질 참고");
    expect(md).toContain("안정적이고 체계적인 환경");
  });

  it("schoolConnectionProse 없으면(Basic) 해당 섹션 없음", () => {
    const md = assembleReport(sampleSaju, {}, {
      ...samplePerspective,
      schoolConnectionProse: undefined,
    });
    expect(md).not.toContain("학교 선택 기질 참고");
  });

  it("사실 블록(학교명)이 관점 블록과 함께 포함됨", () => {
    const factBlock = buildFactBlock(sampleSchools);
    const md = assembleReport(sampleSaju, factBlock, samplePerspective);
    expect(md).toContain("청운초등학교");
    expect(md).toContain("예상 배정");
    expect(md).toContain("타고난 결");
  });

  it("시주 null이면 원국 표에 '—' + 시간 미상 안내", () => {
    const noHour = { ...sampleSaju, pillars: { ...sampleSaju.pillars, hour: null } };
    const md = assembleReport(noHour, {}, samplePerspective);
    expect(md).toContain("출생 시각 미상");
  });

  it("birthYear 있으면 학령 단계 섹션 + 진학 타임라인 + 재학 표기", () => {
    // 2017년생, 기준 2026년 → 초등 입학 2024년 → 3학년
    const md = assembleReport(sampleSaju, {}, samplePerspective, {
      birthYear: 2017,
      currentYear: 2026,
      currentSchoolName: "테스트초등학교",
    });
    expect(md).toContain("지금 우리 아이는 — 초등 3학년");
    expect(md).toContain("입학·진학 타임라인");
    expect(md).toContain("중학교 입학 | 2030년 3월");
    expect(md).toContain("테스트초등학교");
    expect(md).toContain("보호자 입력 정보");
    expect(md).toContain("이 단계에서 기질을 살리려면");
  });

  it("birthYear 없으면 단계 산출 없이 기질 산문만", () => {
    const md = assembleReport(sampleSaju, {}, samplePerspective);
    expect(md).not.toContain("입학·진학 타임라인");
    expect(md).toContain("지금 단계에서 기질을 살리려면");
  });
});

// ──────────────────────────────────────────────────────────────
// 4. generateReport 합성 테스트 (mock LLM)
// ──────────────────────────────────────────────────────────────

describe("generateReport — mock LLM 합성 테스트", () => {
  it("basic: 일간·공부 스타일·대운 섹션 포함 + 시각 기준 표기", async () => {
    const result = await generateReport(
      { saju: sampleSaju, tier: "basic" },
      { llmProvider: makeMockProvider() }
    );
    expect(result.tier).toBe("basic");
    expect(result.markdown).toContain("타고난 결 — 일간 이야기");
    expect(result.markdown).toContain("공부 스타일과 학습 환경");
    expect(result.markdown).toContain("학령기 대운 흐름");
    expect(result.markdown).toContain("동경 127.5°");
  });

  it("basic: 학교 사실 블록 없음", async () => {
    const result = await generateReport(
      { saju: sampleSaju, tier: "basic" },
      { llmProvider: makeMockProvider() }
    );
    // 배정 학교 섹션이 없어야 한다
    expect(result.markdown).not.toContain("예상 배정 학교 (사실 정보)");
    expect(result.markdown).not.toContain(ASSIGNED_SCHOOL_LABEL);
  });

  it("premium: 학교명이 코드에서 삽입됨 (mock LLM이 언급하지 않아도)", async () => {
    // mock LLM은 학교명을 전혀 언급하지 않는다
    const result = await generateReport(
      { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
      { llmProvider: makeMockProvider() }
    );
    // 그럼에도 학교명은 리포트에 있다 → 코드가 삽입했음을 증명
    expect(result.markdown).toContain("청운초등학교");
  });

  it("premium: ASSIGNED_SCHOOL_LABEL이 리포트에 포함됨", async () => {
    const result = await generateReport(
      { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
      { llmProvider: makeMockProvider() }
    );
    expect(result.markdown).toContain(ASSIGNED_SCHOOL_LABEL);
  });

  it("premium: 출처·기준일이 리포트에 포함됨", async () => {
    const result = await generateReport(
      { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
      { llmProvider: makeMockProvider() }
    );
    expect(result.markdown).toContain("2024-03-01");
    expect(result.markdown).toContain("data.go.kr");
  });

  it("premium: schoolConnectionProse가 리포트에 포함됨", async () => {
    const result = await generateReport(
      { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
      { llmProvider: makeMockProvider() }
    );
    expect(result.markdown).toContain("학교 선택 기질 참고");
    expect(result.markdown).toContain("참고 경향이며");
  });

  it("premium schools=undefined: 학교 사실 블록 없음", async () => {
    const result = await generateReport(
      { saju: sampleSaju, tier: "premium" }, // schools 없음
      { llmProvider: makeMockProvider() }
    );
    expect(result.markdown).not.toContain("예상 배정 학교 (사실 정보)");
  });

  it("LLM 응답에 '보장' 포함 → GuardrailError 발행 차단", async () => {
    const badProvider = makeMockProvider({
      studyStyleProse: "이 결과를 보장합니다. 확실한 해석입니다.",
    });
    await expect(
      generateReport({ saju: sampleSaju, tier: "basic" }, { llmProvider: badProvider })
    ).rejects.toThrow(GuardrailError);
  });

  it("LLM 응답에 '이 학교 가면 됩니다' → GuardrailError 발행 차단", async () => {
    const badProvider = makeMockProvider({
      daeunProse: "이 학교 가면 됩니다.",
    });
    await expect(
      generateReport({ saju: sampleSaju, tier: "basic" }, { llmProvider: badProvider })
    ).rejects.toThrow(GuardrailError);
  });

  it("LLM 응답에 '이 학교가 정답' → GuardrailError 발행 차단", async () => {
    const badProvider = makeMockProvider({
      schoolConnectionProse: "이 학교가 정답입니다.",
    });
    await expect(
      generateReport(
        { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
        { llmProvider: badProvider }
      )
    ).rejects.toThrow(GuardrailError);
  });

  it("LLM JSON 아닌 응답 → Error 발생", async () => {
    const badProvider: LlmProvider = {
      async complete() {
        return "죄송합니다, 처리할 수 없습니다.";
      },
    };
    await expect(
      generateReport({ saju: sampleSaju, tier: "basic" }, { llmProvider: badProvider })
    ).rejects.toThrow(/JSON/);
  });

  it("LLM 필수 필드 누락 → Error 발생", async () => {
    const badProvider: LlmProvider = {
      async complete() {
        return JSON.stringify({ dayMasterProse: "일간" }); // elementsProse 이하 누락
      },
    };
    await expect(
      generateReport({ saju: sampleSaju, tier: "basic" }, { llmProvider: badProvider })
    ).rejects.toThrow(/elementsProse/);
  });

  it("사실 블록과 관점 블록이 인과 없이 나란히 배치됨", async () => {
    const result = await generateReport(
      { saju: sampleSaju, schools: sampleSchools, tier: "premium" },
      { llmProvider: makeMockProvider() }
    );
    // 관점 섹션에 학교명 없음 — LLM이 삽입한 게 아니므로
    const studySection = result.markdown.match(
      /## 공부 스타일과 학습 환경\n\n([\s\S]*?)(?=\n\n## )/
    )?.[1] ?? "";
    expect(studySection.length).toBeGreaterThan(0);
    expect(studySection).not.toContain("청운초등학교");

    // 사실 섹션에 학교명 있음 — 코드가 삽입
    expect(result.markdown).toContain("청운초등학교");
  });
});

// ──────────────────────────────────────────────────────────────
// 5. renderReportHtml — 디자인 HTML 렌더러
// ──────────────────────────────────────────────────────────────

describe("renderReportHtml — 디자인 HTML", () => {
  const md = assembleReport(sampleSaju, {}, samplePerspective);

  it("표지에 원국 4기둥 카드가 들어간다 (일주 강조)", () => {
    const html = renderReportHtml(sampleSaju, md, { tier: "basic" });
    expect(html).toContain('class="cover"');
    expect(html).toContain("pillar-day"); // 일주 강조 카드
    expect(html).toContain("戊"); // 일간
    expect(html).toContain("무오"); // 한글 독음
  });

  it("마크다운 본문이 HTML로 변환된다 (표·제목)", () => {
    const html = renderReportHtml(sampleSaju, md);
    expect(html).toContain("<table>");
    expect(html).toContain("<h2>");
    expect(html).toContain("타고난 결 — 일간 이야기");
  });

  it("인쇄(PDF)·모바일 CSS가 포함된다", () => {
    const html = renderReportHtml(sampleSaju, md);
    expect(html).toContain("@media print");
    expect(html).toContain("size: A4");
    expect(html).toContain("@media (max-width");
  });

  it("subjectLabel·샘플 표기 옵션이 반영된다", () => {
    const html = renderReportHtml(sampleSaju, md, {
      subjectLabel: "테스트 대상",
      sampleNotice: "샘플입니다",
    });
    expect(html).toContain("테스트 대상");
    expect(html).toContain("샘플입니다");
  });

  it("시주 null이면 표지 카드에 '시간 모름' 표시", () => {
    const noHour = { ...sampleSaju, pillars: { ...sampleSaju.pillars, hour: null } };
    const html = renderReportHtml(noHour, md);
    expect(html).toContain("시간 모름");
  });
});

// ──────────────────────────────────────────────────────────────
// 6. 통합 테스트 — 실제 Claude API (키 없으면 skip)
// ──────────────────────────────────────────────────────────────

describe("generateReport — 실제 Claude API 통합 테스트", () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  it.skipIf(!apiKey)(
    "실제 API 호출 → guardrails 통과 + 시각 기준 표기 포함",
    async () => {
      const result = await generateReport({
        saju: sampleSaju,
        tier: "basic",
      });
      expect(result.markdown).toContain("공부 기질 해석");
      expect(result.markdown).toContain("대운 흐름");
      expect(result.markdown).toContain("동경 127.5°");
      // guardrails가 통과했으면 여기까지 도달
    },
    30_000 // API 호출 타임아웃 30초
  );

  it.skipIf(!apiKey)(
    "Premium 실제 API 호출 → 학교 사실 코드 삽입 + guardrails 통과",
    async () => {
      const result = await generateReport({
        saju: sampleSaju,
        schools: sampleSchools,
        tier: "premium",
      });
      // 코드가 삽입한 학교 사실
      expect(result.markdown).toContain("청운초등학교");
      expect(result.markdown).toContain(ASSIGNED_SCHOOL_LABEL);
      // guardrails 통과
      expect(result.markdown).toContain("동경 127.5°");
    },
    30_000
  );
});
