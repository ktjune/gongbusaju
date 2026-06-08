/**
 * lib/report — 유일하게 두 레이어를 import 할 수 있는 곳
 *
 * lib/saju (해석 레이어) + lib/schools (사실 레이어) → 리포트 생성
 *
 * [절대 규칙] 학교명·진학률 등 사실은 코드(템플릿)가 삽입한다.
 * LLM은 관점 산문(해석·연결)만 작성하며 학교 사실을 만들거나 바꾸지 않는다.
 *
 * TODO [빌드 순서 4단계]: lib/report 구현
 *   - template.ts    사실 블록 / 관점 블록 템플릿
 *   - generate.ts    Claude API 호출 (좁은 역할)
 *   - guardrails.ts  금지표현 검사
 */

import type { SajuResult } from "../saju";
import type { SchoolFacts } from "../schools";

export type ReportInput = {
  saju: SajuResult;
  schools?: SchoolFacts;
  tier: "basic" | "premium";
};

// placeholder — 구현 예정
export type {};
