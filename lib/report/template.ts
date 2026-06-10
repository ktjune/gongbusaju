/**
 * lib/report/template.ts
 * 사실 블록 / 관점 블록 분리 템플릿
 *
 * [절대 규칙]
 * - 학교명·수치 등 사실은 buildFactBlock()(코드)가 생성한다. LLM에게 전달되지 않는다.
 * - 배정 학교는 항상 ASSIGNED_LABEL + 출처·기준일을 붙인다.
 * - 두 블록(사실/관점)은 assembleReport()에서 나란히 배치된다.
 *   "오행이 X라 이 학교가 정답" 같은 인과 연결은 어디에도 없다.
 */

import type { SchoolFacts, SchoolRecord } from "../schools";

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

/** 만세력 계산 기준 표기 — 모든 리포트 하단 필수 포함 */
export const TIME_STANDARD_NOTICE =
  "본 리포트의 사주 계산 기준: 일주·시주는 동경 127.5° 경도 보정(-30분), " +
  "연주·월주는 한국천문연구원(KASI) 절입시각(KST)을 따릅니다.";

/** 학교 배정 결과에 항상 붙이는 라벨 */
export const ASSIGNED_SCHOOL_LABEL = "예상 배정(교육청 확인 필요)";

// ──────────────────────────────────────────────────────────────
// 블록 타입
// ──────────────────────────────────────────────────────────────

/**
 * 사실 블록 — 학교 정보 텍스트.
 * 코드(buildFactBlock)가 생성한다. LLM에게 전달되지 않으며 수정도 불가.
 */
export type FactBlock = {
  /** 예상 배정 학교 섹션 (코드 생성) */
  assignedSchoolSection?: string;
  /** 반경 2km 이내 학교군 섹션 (코드 생성) */
  clusterSection?: string;
};

/**
 * 관점(해석) 블록 — LLM이 작성하는 산문.
 * 학교 사실(이름·주소·거리·진학률)을 포함해서는 안 된다.
 */
export type PerspectiveBlock = {
  /** 오행·십성 기반 공부 기질 해석 산문 */
  studyTraitsProse: string;
  /** 대운 흐름 해석 산문 */
  daeunProse: string;
  /**
   * [Premium] 학교 선택 시 기질 관점에서 참고할 경향 산문.
   * 학교명·사실 절대 포함 금지.
   */
  schoolConnectionProse?: string;
};

// ──────────────────────────────────────────────────────────────
// 사실 블록 빌더 — 코드만, LLM 없음
// ──────────────────────────────────────────────────────────────

/**
 * SchoolFacts → 사실 블록 텍스트 변환.
 *
 * 이 함수의 출력이 LLM에게 전달되지 않는다.
 * 코드가 학교 사실을 직접 마크다운으로 변환해 리포트에 삽입한다.
 */
export function buildFactBlock(schools: SchoolFacts): FactBlock {
  let assignedSchoolSection: string | undefined;
  let clusterSection: string | undefined;

  // ── 배정 예상 학교 ───────────────────────────────────────
  if (schools.assignedSchool) {
    const s = schools.assignedSchool;
    const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
    assignedSchoolSection = [
      `**${s.name}** (${s.type})`,
      ``,
      `| 항목 | 내용 |`,
      `|---|---|`,
      `| 라벨 | ${s.assignedLabel} |`,
      `| 통학거리 | 약 ${distKm}km |`,
      `| 주소 | ${s.address} |`,
      `| 출처 | ${schools.source} |`,
      `| 기준일 | ${schools.asOf} |`,
    ].join("\n");
  }

  // ── 반경 2km 이내 학교군 ─────────────────────────────────
  if (schools.cluster.length > 0) {
    const rows = schools.cluster
      .map((s: SchoolRecord) => {
        const distKm = (Math.round(s.distanceM / 100) / 10).toFixed(1);
        return `| ${s.name} | ${s.type} | 약 ${distKm}km |`;
      })
      .join("\n");

    clusterSection = [
      `### 반경 2km 이내 학교`,
      ``,
      `| 학교명 | 종류 | 통학거리 |`,
      `|---|---|---|`,
      rows,
      ``,
      `출처: ${schools.source} | 기준일: ${schools.asOf}`,
    ].join("\n");
  }

  return { assignedSchoolSection, clusterSection };
}

// ──────────────────────────────────────────────────────────────
// 리포트 조립
// ──────────────────────────────────────────────────────────────

/**
 * 사실 블록과 관점 블록을 합쳐 최종 리포트 마크다운을 조립한다.
 *
 * 조립 순서:
 * 1. 공부 기질 해석 (관점)
 * 2. 대운 흐름 (관점)
 * 3. [Premium] 기질 관점에서의 학교 선택 참고 (관점)
 * 4. [Premium] 예상 배정 학교 (사실)
 * 5. [Premium] 반경 내 학교군 (사실)
 * 6. 만세력 기준 표기 (항상)
 *
 * 관점 블록과 사실 블록 사이에 "이 학교가 정답" 같은 인과 연결은 없다.
 */
export function assembleReport(
  facts: FactBlock,
  perspective: PerspectiveBlock
): string {
  const sections: string[] = [];

  // ── 관점 블록 (LLM 산문) ─────────────────────────────────
  sections.push("## 공부 기질 해석\n\n" + perspective.studyTraitsProse);
  sections.push("## 대운 흐름\n\n" + perspective.daeunProse);

  if (perspective.schoolConnectionProse) {
    sections.push(
      "## 학교 선택 기질 참고\n\n" +
        "> 아래는 사주 기질 관점에서 학교 환경 선택 시 참고할 만한 경향입니다.\n" +
        "> 특정 학교를 추천하거나 정답으로 지목하지 않습니다.\n\n" +
        perspective.schoolConnectionProse
    );
  }

  // ── 사실 블록 (코드 삽입) ────────────────────────────────
  if (facts.assignedSchoolSection) {
    sections.push(
      "## 예상 배정 학교 (사실 정보)\n\n" +
        "> 아래 정보는 공공데이터 기반 예상 배정 결과입니다. " +
        "실제 배정은 교육청에 반드시 확인하시기 바랍니다.\n\n" +
        facts.assignedSchoolSection
    );
  }

  if (facts.clusterSection) {
    sections.push(facts.clusterSection);
  }

  // ── 만세력 기준 표기 (항상 마지막) ───────────────────────
  sections.push("---\n\n" + TIME_STANDARD_NOTICE);

  return sections.join("\n\n");
}
