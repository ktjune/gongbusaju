import { describe, it, expect } from "vitest";
import { classifyPayment, mayInvolveRealMoney } from "../classify";

describe("classifyPayment", () => {
  it("paymentKey 없으면 모의결제 — 환불할 돈이 없다", () => {
    for (const empty of [null, undefined, ""]) {
      const c = classifyPayment(empty);
      expect(c.kind).toBe("none");
      expect(c.needsCare).toBe(false);
    }
  });

  it("tgen_ 접두사는 토스 테스트 결제 — 실제 출금 없음", () => {
    // 운영 DB에 실제로 남아 있던 값
    const c = classifyPayment("tgen_20260807175400xvGs6");
    expect(c.kind).toBe("test");
    expect(c.needsCare).toBe(false);
    expect(c.provider).toBe("toss");
  });

  it("포트원 paymentId는 접두사만으로 단정하지 않는다 — 조회 필요", () => {
    const c = classifyPayment("gbg_0f9c1e2a3b4c5d6e7f80");
    expect(c.kind).toBe("unknown");
    expect(c.needsCare).toBe(true);
    expect(c.provider).toBe("portone");
  });

  it("알 수 없는 형식은 보수적으로 실결제 취급", () => {
    const c = classifyPayment("5EnNZRJGvaBX7zk2yd8ydw26XvwXkLrx9POLqKQjmAw4b0e1");
    expect(c.kind).toBe("live");
    expect(c.needsCare).toBe(true);
  });

  it("mayInvolveRealMoney는 테스트·모의를 걸러낸다", () => {
    expect(mayInvolveRealMoney(null)).toBe(false);
    expect(mayInvolveRealMoney("tgen_20260807175400xvGs6")).toBe(false);
    expect(mayInvolveRealMoney("gbg_0f9c1e2a3b4c5d6e7f80")).toBe(true);
    expect(mayInvolveRealMoney("tviva20260807120000abcd")).toBe(true);
  });
});
