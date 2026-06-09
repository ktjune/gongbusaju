/**
 * lib/report/template.ts
 * 사실 블록 / 관점 블록 분리 템플릿
 *
 * [절대 규칙]
 * - 학교명·수치 등 사실은 이 템플릿 코드가 삽입한다. LLM은 못 바꾼다.
 * - 배정 학교는 항상 ASSIGNED_LABEL + 출처·기준일을 붙인다.
 * - 단정·보장·인과 표현 금지. "참고/경향/해석"만 허용.
 *
 * TODO [빌드 순서 4단계]: 실제 템플릿 + LLM 연결 구현
 */

/** 만세력 계산 기준 표기 — 모든 리포트 하단에 포함해야 한다 */
export const TIME_STANDARD_NOTICE =
  "본 리포트의 사주 계산은 동경 135° 표준시(KST) 기준입니다.";

/** 학교 배정 결과에 항상 붙이는 라벨 */
export const ASSIGNED_SCHOOL_LABEL = "예상 배정(교육청 확인 필요)";

/** 사실 블록 — 학교 정보 (LLM에게 전달되지 않음) */
export type FactBlock = {
  assignedSchoolSection?: string; // 코드가 생성, LLM 미전달
  clusterSection?: string;        // 코드가 생성, LLM 미전달
};

/** 관점 블록 — LLM이 작성하는 해석 산문 */
export type PerspectiveBlock = {
  studyTraitsProse: string;  // 공부·기질 해석 (LLM 작성)
  daeunProse: string;        // 대운 흐름 해석 (LLM 작성)
};

/**
 * 사실 블록과 관점 블록을 합쳐 최종 리포트 텍스트를 조립한다.
 * 두 블록은 절대 뒤섞이지 않는다.
 */
export function assembleReport(
  facts: FactBlock,
  perspective: PerspectiveBlock
): string {
  const sections: string[] = [];

  if (perspective.studyTraitsProse) {
    sections.push("## 공부 기질 해석\n\n" + perspective.studyTraitsProse);
  }

  if (perspective.daeunProse) {
    sections.push("## 대운 흐름\n\n" + perspective.daeunProse);
  }

  if (facts.assignedSchoolSection) {
    sections.push(
      "## 학교 정보 (사실)\n\n" +
        facts.assignedSchoolSection
    );
  }

  if (facts.clusterSection) {
    sections.push(facts.clusterSection);
  }

  // 만세력 기준 표기 — 항상 마지막에 포함
  sections.push("---\n\n" + TIME_STANDARD_NOTICE);

  return sections.join("\n\n");
}
