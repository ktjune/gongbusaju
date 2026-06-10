/**
 * scripts/sample-report.ts
 * 샘플 리포트 생성 — 결과물 미리보기용
 *
 * 실행: npx tsx scripts/sample-report.ts
 *
 * 프로덕션 파이프라인과 동일한 경로를 탄다:
 *   computeSaju(실계산) → generateReport(guardrails 검사 + 템플릿 조립)
 * 단, LLM 관점 산문만 미리 작성된 텍스트로 주입한다 (ANTHROPIC_API_KEY 불필요).
 * 실서비스에서는 같은 자리에서 Claude API가 산문을 생성한다.
 */

import { writeFileSync } from "node:fs";
import { computeSaju } from "../lib/saju";
import type { SchoolFacts } from "../lib/schools";
import { generateReport } from "../lib/report";
import type { LlmProvider } from "../lib/report";

// ──────────────────────────────────────────────────────────────
// 1. 사주 실계산 — 2020-09-16 16:43 남 (점신 교차검증 케이스)
// ──────────────────────────────────────────────────────────────

const saju = computeSaju({
  birthYear: 2020,
  birthMonth: 9,
  birthDay: 16,
  birthHour: 16,
  birthMinute: 43,
  gender: "male",
});

// ──────────────────────────────────────────────────────────────
// 2. 학교 사실 — 샘플 데이터 (Premium 데모용, data-pipeline 픽스처 기반)
// ──────────────────────────────────────────────────────────────

const schools: SchoolFacts = {
  assignedSchool: {
    schoolId: "B100000148",
    name: "청운초등학교",
    type: "초등학교",
    address: "서울특별시 종로구 자하문로 91",
    lat: 37.584045,
    lng: 126.963211,
    distanceM: 320,
    source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148) [샘플]",
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
      source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148) [샘플]",
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
      source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148) [샘플]",
      asOf: "2024-03-01",
    },
  ],
  source: "전국초중등학교위치표준데이터(data.go.kr/data/15021148) [샘플]",
  asOf: "2024-03-01",
};

// ──────────────────────────────────────────────────────────────
// 3. 관점 산문 — 실서비스에서 Claude API가 작성하는 부분
//    (이 사주의 실제 계산값에 맞춰 작성: 금·수 강, 화 0, 인성 3·칠살 2,
//     첫 대운 丙戌 만 7세 2개월 순행)
// ──────────────────────────────────────────────────────────────

const perspectiveProvider: LlmProvider = {
  async complete() {
    return JSON.stringify({
      studyTraitsProse: [
        "이 아이의 사주는 금(金)과 수(水) 기운이 중심을 이루고 있습니다. 금 기운이 강한 아이는",
        "사물을 또렷하게 구분하고 정리하는 힘이 좋아, 규칙을 익히고 순서대로 해내는 학습에서",
        "강점을 보이는 경향이 있습니다. 수 기운은 받아들인 것을 곱씹어 자기 것으로 만드는",
        "흡수력과 기억력으로 해석됩니다.\n\n",
        "십성으로는 인성(印星)이 세 개로 두드러집니다. 인성은 배우고 받아들이는 힘을 뜻해,",
        "어른의 설명을 잘 듣고 책이나 이야기를 통해 배우는 것을 즐기는 기질로 풀이됩니다.",
        "칠살(七杀)이 함께 있어 스스로에게 엄격해지는 면도 보이는데, 잘하고 싶은 마음이 큰 만큼",
        "틀리는 것을 두려워할 수 있으니 결과보다 시도를 칭찬해 주는 양육 태도가 도움이 될 수 있습니다.\n\n",
        "한편 화(火) 기운은 드러나지 않는 구성입니다. 화는 표현하고 발산하는 에너지로 해석되므로,",
        "발표·노래·몸놀이처럼 밖으로 꺼내는 활동을 의식적으로 곁들여 주면 균형 잡힌 발달에",
        "참고가 될 수 있습니다. 이 해석은 사주 명리의 관점일 뿐 실측된 성격 검사 결과가 아니며,",
        "아이의 실제 모습이 늘 우선입니다.",
      ].join(" "),
      daeunProse: [
        "대운은 만 7세 2개월부터 병술(丙戌) 대운이 시작됩니다. 초등 1~2학년 무렵 화(火) 기운이",
        "들어오는 흐름이라, 원래 조용히 받아들이는 쪽이 강한 이 아이가 자기 생각을 밖으로",
        "표현해 보는 경험을 쌓기 좋은 시기로 해석됩니다. 입학 전후에는 새로운 환경을 천천히",
        "받아들일 시간을 충분히 주고, 입학 후에는 발표나 모둠 활동처럼 표현 기회를 의식적으로",
        "만들어 주는 것이 기질 발현에 참고가 될 수 있습니다.\n\n",
        "그 이전인 지금(만 5세)은 아직 태어난 사주의 기질이 그대로 드러나는 구간입니다.",
        "익숙한 공간에서 반복되는 일과를 좋아하는 경향이 있으니, 학습 습관도 같은 시간·같은",
        "자리에서 짧게 반복하는 방식이 잘 맞는 편으로 풀이됩니다.",
      ].join(" "),
      schoolConnectionProse: [
        "금·수 기운이 강하고 인성이 발달한 기질은 차분하고 예측 가능한 환경에서 안정감을 얻는",
        "경향이 있습니다. 학급 규모가 지나치게 크거나 자극이 많은 환경보다는, 일과가 규칙적이고",
        "교사와의 상호작용이 촘촘한 환경이 기질 발현에 참고가 될 수 있습니다. 또한 화 기운을",
        "보완하는 관점에서 예체능·발표 활동이 활발한 프로그램이 있는지 살펴보는 것도 한 가지",
        "참고 기준이 됩니다. 어떤 학교가 좋다·나쁘다의 판단이 아니며, 통학 거리·가정 여건 등",
        "여러 요소를 종합해 보호자께서 판단하시기 바랍니다.",
      ].join(" "),
    });
  },
};

// ──────────────────────────────────────────────────────────────
// 4. 리포트 생성 — guardrails 검사 + 템플릿 조립 (실제 코드 경로)
// ──────────────────────────────────────────────────────────────

async function main() {
  const result = await generateReport(
    { saju, schools, tier: "premium" },
    { llmProvider: perspectiveProvider }
  );

  // 리포트 상단에 사주 요약(코드 생성 사실 블록) 추가 — Phase 5 결과페이지에서 정식 구현 예정
  const header = [
    `# 공부 기질 사주 리포트 (샘플)`,
    ``,
    `> 대상: 2020년 9월 16일 16:43 출생 남아 (만 5세) · Premium 샘플`,
    `> ⚠️ 본 문서는 결과물 미리보기용 샘플입니다. 학교 정보는 샘플 데이터입니다.`,
    ``,
    `## 사주 요약`,
    ``,
    `| 구분 | 時柱 | 日柱 | 月柱 | 年柱 |`,
    `|---|---|---|---|---|`,
    `| 간지 | ${saju.pillars.hour} | ${saju.pillars.day} | ${saju.pillars.month} | ${saju.pillars.year} |`,
    ``,
    `오행: 금 ${Math.round(saju.elements.금)}% · 수 ${Math.round(saju.elements.수)}% · 토 ${Math.round(saju.elements.토)}% · 목 ${Math.round(saju.elements.목)}% · 화 ${Math.round(saju.elements.화)}%`,
    ``,
    `첫 대운: ${saju.daeun[0].ganji} (만 ${saju.daeun[0].age}세 ${saju.daeun[0].startMonths}개월부터)`,
    ``,
  ].join("\n");

  const md = header + "\n" + result.markdown + "\n";
  writeFileSync("SAMPLE_REPORT.md", md, "utf-8");
  console.log(md);
  console.log("\n→ SAMPLE_REPORT.md 저장 완료 (guardrails 통과)");
}

main().catch((e) => {
  console.error("생성 실패:", e.message);
  process.exit(1);
});
