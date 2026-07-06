import { describe, it, expect } from "vitest";
import { choElement, elementRelation, analyzeName } from "../nameology";
import type { SajuResult } from "../../saju";

/** 오행 분포만 주입한 최소 SajuResult 스텁 */
function sajuWith(elements: SajuResult["elements"]): SajuResult {
  return { elements } as unknown as SajuResult;
}

describe("choElement — 초성 발음오행", () => {
  it("초성별 오행 매핑", () => {
    expect(choElement("가")).toBe("木"); // ㄱ
    expect(choElement("나")).toBe("火"); // ㄴ
    expect(choElement("마")).toBe("水"); // ㅁ
    expect(choElement("사")).toBe("金"); // ㅅ
    expect(choElement("아")).toBe("土"); // ㅇ
    expect(choElement("준")).toBe("金"); // ㅈ
  });
  it("한글이 아니면 null", () => {
    expect(choElement("A")).toBeNull();
    expect(choElement("俊")).toBeNull();
  });
});

describe("elementRelation", () => {
  it("상생·상극·비화", () => {
    expect(elementRelation("木", "火")).toBe("상생");
    expect(elementRelation("木", "土")).toBe("상극");
    expect(elementRelation("金", "金")).toBe("비화");
  });
});

describe("analyzeName — 이름-사주 어울림", () => {
  it("보완형: 이름이 사주의 약한 오행을 채움", () => {
    // 사주 火 약함(0), 이름 '나라'(火·火) → 보완
    const saju = sajuWith({ 목: 30, 화: 0, 토: 25, 금: 25, 수: 20 });
    const a = analyzeName("나라", saju)!;
    expect(a.weakEl).toBe("火");
    expect(a.complementType).toBe("보완");
  });

  it("강화형: 이름이 이미 강한 오행을 더함", () => {
    // 사주 金 강함, 이름 '준서'(金·金) → 강화
    const saju = sajuWith({ 목: 13, 화: 0, 토: 25, 금: 38, 수: 24 });
    const a = analyzeName("준서", saju)!;
    expect(a.strongEl).toBe("金");
    expect(a.complementType).toBe("강화");
    expect(a.flow).toBe("비화");
  });

  it("상극 흐름 감지", () => {
    // '가마'(木·水) → 木水는 상생, '가아'(木·土) → 상극
    const saju = sajuWith({ 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 });
    expect(analyzeName("가아", saju)!.flow).toBe("상극");
  });

  it("한글 없으면 null", () => {
    const saju = sajuWith({ 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 });
    expect(analyzeName("Tom", saju)).toBeNull();
  });
});
