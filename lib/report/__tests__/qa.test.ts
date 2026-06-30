/**
 * lib/report/qa.ts 테스트
 *
 * 구조 검사(분량·금지표현)만 단위 테스트.
 * LLM 재검토(runLlmQaReview)는 실제 API 호출이라 mock provider로 별도 검증.
 */

import { describe, it, expect } from "vitest";
import { runStructuralQa, runReportQa } from "../qa";
import type { LlmProvider } from "../generate";

const LONG_OK_MARKDOWN = "정상적인 리포트 내용입니다. ".repeat(200); // 3000자 이상

describe("runStructuralQa", () => {
  it("정상 분량·표현이면 이슈 없음", () => {
    const issues = runStructuralQa(LONG_OK_MARKDOWN);
    expect(issues).toHaveLength(0);
  });

  it("분량이 너무 짧으면 이슈를 낸다", () => {
    const issues = runStructuralQa("너무 짧은 리포트");
    expect(issues.some((i) => i.includes("분량"))).toBe(true);
  });

  it("금지 표현이 있으면 이슈를 낸다", () => {
    const md = LONG_OK_MARKDOWN + " 이 학교에 가야 합니다.";
    const issues = runStructuralQa(md);
    expect(issues.some((i) => i.includes("금지"))).toBe(true);
  });
});

describe("runReportQa", () => {
  it("구조 검사 실패 시 LLM을 호출하지 않고 즉시 반환한다", async () => {
    let called = false;
    const provider: LlmProvider = {
      async complete() {
        called = true;
        return '{"issues":[]}';
      },
    };
    const result = await runReportQa("짧음", provider);
    expect(result.passed).toBe(false);
    expect(called).toBe(false);
  });

  it("구조 검사 통과 + LLM이 문제 없다고 하면 최종 통과", async () => {
    const provider: LlmProvider = {
      async complete() {
        return '{"issues":[]}';
      },
    };
    const result = await runReportQa(LONG_OK_MARKDOWN, provider);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("구조 검사 통과했지만 LLM이 문제를 발견하면 실패", async () => {
    const provider: LlmProvider = {
      async complete() {
        return '{"issues":["오타: \\"학교\\"가 \\"학고\\"로 표기됨"]}';
      },
    };
    const result = await runReportQa(LONG_OK_MARKDOWN, provider);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});
