/**
 * lib/report/stage.ts
 * 학령 단계 산출 + 단계별 정적 가이드 — 코드 결정론, LLM 미관여
 *
 * 한국 학제 기준:
 * 초중등교육법 제13조 — 만 6세가 된 날이 속하는 해의 다음 해 3월 1일 입학.
 * → 초등 입학 연도 = 출생연도 + 7 (1~12월생 동일, 같은 출생연도 = 같은 학년)
 */

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export type SchoolStageKey =
  | "preschool"      // 미취학 (입학 2년 이상 전)
  | "pre-elementary" // 예비 초등 (입학 전 1년)
  | "elem-lower"     // 초등 1~2학년
  | "elem-middle"    // 초등 3~4학년
  | "elem-upper"     // 초등 5~6학년
  | "middle"         // 중학교
  | "high"           // 고등학교
  | "post-school";   // 고교 졸업 이후

export type SchoolStage = {
  key: SchoolStageKey;
  /** 표시 라벨 (예: "예비 초등", "초등 3학년") */
  label: string;
  /** 학년 (초1=1 … 고3=12, 미취학·졸업 후는 undefined) */
  grade?: number;
  /** 초등 입학 연도 (3월 기준) */
  elementaryEntryYear: number;
  /** 중학교 입학 연도 */
  middleEntryYear: number;
  /** 고등학교 입학 연도 */
  highEntryYear: number;
};

// ──────────────────────────────────────────────────────────────
// 단계 산출
// ──────────────────────────────────────────────────────────────

/**
 * 출생연도와 기준연도로 학령 단계를 산출한다.
 *
 * 학년은 3월 학기 시작 기준의 근사값이다 (기준연도에 해당 학년에
 * 재학 중이거나 3월부터 재학 예정). 1~2월 출생 조기입학·유예 등
 * 개별 사정은 반영하지 않으며, 리포트에는 "기준" 문구를 함께 표기한다.
 */
export function deriveSchoolStage(
  birthYear: number,
  currentYear: number
): SchoolStage {
  const entry = birthYear + 7;
  const base = {
    elementaryEntryYear: entry,
    middleEntryYear: entry + 6,
    highEntryYear: entry + 9,
  };

  const grade = currentYear - entry + 1; // 초1=1 … 고3=12

  if (grade < 0) {
    return { key: "preschool", label: "미취학", ...base };
  }
  if (grade === 0) {
    return { key: "pre-elementary", label: "예비 초등 (내년 3월 입학)", ...base };
  }
  if (grade <= 2) {
    return { key: "elem-lower", label: `초등 ${grade}학년`, grade, ...base };
  }
  if (grade <= 4) {
    return { key: "elem-middle", label: `초등 ${grade}학년`, grade, ...base };
  }
  if (grade <= 6) {
    return { key: "elem-upper", label: `초등 ${grade}학년`, grade, ...base };
  }
  if (grade <= 9) {
    return { key: "middle", label: `중학교 ${grade - 6}학년`, grade, ...base };
  }
  if (grade <= 12) {
    return { key: "high", label: `고등학교 ${grade - 9}학년`, grade, ...base };
  }
  return { key: "post-school", label: "고교 졸업 이후", ...base };
}

// ──────────────────────────────────────────────────────────────
// 단계별 정적 가이드 (공통 안내 — 기질 결합 산문은 LLM stageProse 담당)
// ──────────────────────────────────────────────────────────────

export const STAGE_GUIDE: Record<SchoolStageKey, { title: string; body: string }> = {
  preschool: {
    title: "마음껏 노는 힘이 공부의 뿌리가 되는 시기",
    body: `아직 '공부'를 시작할 때가 아니라 **공부의 그릇을 빚는 시기**입니다. 이 시기의 놀이·대화·생활 습관이 이후 학습 태도의 바탕이 됩니다.

- 정해진 학습보다 아이가 스스로 고른 놀이에 몰입하는 경험을 충분히
- 그림책 읽어 주기 — 내용 확인 질문보다 "어땠어?" 같은 느낌 대화
- 일정한 수면·식사 리듬 — 규칙적인 하루가 곧 첫 학습 습관`,
  },
  "pre-elementary": {
    title: "입학 전 1년 — 공부보다 '학교라는 공간'을 준비하는 시기",
    body: `한글·숫자 선행보다 **학교 생활 자체에 대한 안정감**을 만드는 것이 이 시기의 핵심 과제로 꼽힙니다.

- 초등학교 운동장·통학로를 미리 산책하며 공간을 익숙하게
- "40분 앉아 있기"보다 10~15분 책상 앞 루틴부터 시작
- 스스로 가방 싸기·신발 정리 같은 자조 능력 기르기
- 입학 전 예방접종·취학통지서 일정 챙기기 (행정 사항)`,
  },
  "elem-lower": {
    title: "초등 1~2학년 — 학습 습관의 틀이 잡히는 시기",
    body: `성적보다 **"공부는 매일 하는 것"이라는 감각**을 만드는 시기입니다. 이때 형성된 루틴이 고학년 자기주도 학습의 토대가 됩니다.

- 같은 시간·같은 자리에서 짧게(20~30분) 끝나는 홈스터디 루틴
- 받아쓰기·연산 결과보다 "오늘 해냈다"는 완료 경험에 초점
- 학교에서 있었던 일을 매일 한 가지씩 이야기하는 대화 습관`,
  },
  "elem-middle": {
    title: "초등 3~4학년 — 교과가 본격화되고 호불호가 드러나는 시기",
    body: `사회·과학이 더해지고 글밥이 늘면서 **과목 선호가 처음 드러나는 구간**입니다. 잘하는 과목으로 자신감을, 어려운 과목은 낮은 계단으로.

- 좋아하는 과목 1개를 '내 과목'으로 깊게 파는 경험
- 독서가 모든 과목의 체력이 되는 시기 — 분야를 넓혀 주기
- 어려워하는 과목은 진도보다 구멍(기초 개념) 메우기 우선`,
  },
  "elem-upper": {
    title: "초등 5~6학년 — 자기주도로 넘어가는 전환점",
    body: `부모 주도에서 **아이 주도로 핸들을 넘기기 시작하는 시기**입니다. 중학교 진학을 앞두고 학습량보다 '스스로 계획하는 경험'이 중요해집니다.

- 주간 계획표를 아이가 직접 세우고 부모는 점검만
- 중학교 배정 방식(거주지 학군)을 미리 확인해 두기
- 사춘기 진입기 — 공부 대화와 감정 대화를 분리하기`,
  },
  middle: {
    title: "중학교 — 시험과 내신이 시작되는 시기",
    body: `자유학기제를 지나 첫 지필고사를 만나며 **'시험을 치르는 기술'을 배우는 구간**입니다. 고입 전형(일반고·특목고·자사고 등) 정보도 슬슬 필요해집니다.

- 시험 2~3주 전 계획표 작성 연습 — 결과보다 계획-실행 복기
- 오답 노트 등 자기만의 정리 도구 만들기
- 진로 탐색 활동(자유학기·동아리)을 기질과 연결해 보기`,
  },
  high: {
    title: "고등학교 — 내신·수능·진로가 맞물리는 시기",
    body: `학습 전략의 비중이 가장 커지는 구간입니다. **기질에 맞는 공부 방식을 아는 것**이 학습량만큼 중요해집니다.

- 내신 일정 중심의 학기 운영 + 방학은 취약 단원 보강
- 진로·전공 탐색을 구체화 — 흥미가 오래 머문 분야가 단서
- 체력·수면 관리가 곧 성적 관리인 시기`,
  },
  "post-school": {
    title: "고교 졸업 이후",
    body: `학령기를 지나 성인 학습·진로의 단계입니다. 본 리포트의 학령기 안내 대신 대운 흐름과 기질 해석을 중심으로 참고해 주세요.`,
  },
};

// ──────────────────────────────────────────────────────────────
// 진학 타임라인 표
// ──────────────────────────────────────────────────────────────

/** 입학·진학 타임라인 마크다운 표 (만나이는 3월 입학 시점 기준 근사) */
export function buildStageTimeline(
  stage: SchoolStage,
  birthYear: number,
  currentYear: number
): string {
  const rows: Array<[string, number]> = [
    ["초등학교 입학", stage.elementaryEntryYear],
    ["중학교 입학", stage.middleEntryYear],
    ["고등학교 입학", stage.highEntryYear],
    ["고등학교 졸업", stage.highEntryYear + 3],
  ];

  const lines = rows.map(([label, year]) => {
    const age = year - birthYear; // 3월 시점 만나이는 생일 전이면 -1이나, 학제 표기는 연 단위 근사
    const when =
      year < currentYear ? "지남" : year === currentYear ? "**올해**" : `${year - currentYear}년 후`;
    return `| ${label} | ${year}년 3월 | 만 ${age - 1}~${age}세 | ${when} |`;
  });

  return [
    `| 단계 | 시기 | 나이 | 남은 기간 |`,
    `|---|---|---|---|`,
    ...lines,
    ``,
    `<p class="datanote">취학 기준(초중등교육법): 만 6세가 된 해의 다음 해 3월 입학. 조기입학·유예 등 개별 사정은 반영되지 않은 표준 학제 기준입니다.</p>`,
  ].join("\n");
}
