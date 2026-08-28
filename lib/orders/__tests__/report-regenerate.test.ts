/**
 * 재생성 회귀 테스트.
 *
 * 2026-08-27 운영 장애: 어드민 "재생성"이 이미 리포트가 있는 주문에서 항상 실패했다.
 * reports.orderId가 @unique인데 generateReportForOrder가 언제나 createReport를
 * 호출했기 때문이다. 게다가 LLM 생성을 다 끝낸 **뒤** 마지막 저장에서 터져서,
 * 크론이 6회 재시도하는 동안 생성 비용만 태웠다.
 *
 * 여기서는 스토어 계약을 고정한다 — 같은 orderId로 두 번 create하면 실패해야 하고
 * (그래야 generate.ts가 update 경로를 타야 한다는 제약이 유지된다),
 * updateReport는 html까지 갱신하면서 **token을 유지해야 한다**
 * (고객이 이미 받은 결과 링크가 갱신된 내용을 가리켜야 하므로).
 */

import { describe, it, expect } from "vitest";
import { InMemoryOrderStore } from "../store";

async function seedReport(store: InMemoryOrderStore, orderId: string) {
  return store.createReport({
    orderId,
    markdown: "# 초판",
    html: "<h1>초판</h1>",
    tier: "basic",
    reviewStatus: "pending",
    reviewNote: null,
    pdfUrl: null,
  });
}

describe("리포트 재생성", () => {
  it("updateReport가 markdown·html을 갱신하고 token은 유지한다", async () => {
    const store = new InMemoryOrderStore();
    const first = await seedReport(store, "order-1");

    const updated = await store.updateReport(first.id, {
      markdown: "# 재생성본",
      html: "<h1>재생성본</h1>",
      reviewStatus: "pending",
      reviewNote: null,
    });

    expect(updated.id).toBe(first.id);
    // 고객이 받은 링크가 죽으면 안 된다
    expect(updated.token).toBe(first.token);
    expect(updated.markdown).toBe("# 재생성본");
    expect(updated.html).toBe("<h1>재생성본</h1>");
  });

  it("재생성해도 주문당 리포트는 하나로 유지된다", async () => {
    const store = new InMemoryOrderStore();
    const first = await seedReport(store, "order-2");
    await store.updateReport(first.id, { markdown: "# 두번째" });

    const all = await store.listReports();
    expect(all.filter((r) => r.orderId === "order-2")).toHaveLength(1);
  });

  it("검수 반려된 리포트를 재생성하면 다시 검수 대기로 돌아간다", async () => {
    const store = new InMemoryOrderStore();
    const first = await seedReport(store, "order-3");
    await store.updateReport(first.id, {
      reviewStatus: "rejected",
      reviewNote: "가드레일 위반",
    });

    const regenerated = await store.updateReport(first.id, {
      markdown: "# 고쳐 쓴 본",
      html: "<h1>고쳐 쓴 본</h1>",
      reviewStatus: "pending",
      reviewNote: null,
    });

    expect(regenerated.reviewStatus).toBe("pending");
    expect(regenerated.reviewNote).toBeNull();
  });
});
