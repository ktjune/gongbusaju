/**
 * lib/orders/generate.ts
 * 주문 → 리포트 생성 오케스트레이션 (검수 대기까지)
 *
 * 흐름: paid → generating → (사주계산+학교조회+리포트+렌더) → review
 *   - 자녀 PII는 여기서만 복호화해 메모리에서 사용, 즉시 폐기.
 *   - 생성된 리포트는 reviewStatus=pending으로 저장 (검수 후 published).
 *   - lib/report.buildReportForSubject가 saju·schools 합류를 담당 → orders는
 *     saju·schools를 직접 import하지 않는다.
 *
 * [데모] DATABASE_URL 없으면 data-pipeline 산출물(서울 통학구역·전국 학교)을
 * 픽스처로 로드해 배정 학교를 채운다. 프로덕션은 PostGIS 경로.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildReportForSubject } from "../report";
import type { SchoolFixture, ZoneCollection } from "../schools";
import { getOrderStore } from "./store";
import { decryptSubject } from "./index";
import type { Order, Report } from "./types";

// 픽스처는 한 번만 읽어 캐시
let fixtureCache: { schools?: SchoolFixture[]; zones?: ZoneCollection } | null = null;

function loadFixtures(): { schools?: SchoolFixture[]; zones?: ZoneCollection } {
  if (fixtureCache) return fixtureCache;
  // 학교 사실은 파일 픽스처를 쓴다(PostGIS는 아직 Supabase에 미적재).
  // 주문 DB(DATABASE_URL)와는 독립 — DATABASE_URL이 있어도 학교는 픽스처 경로.
  // TODO: 학교 PostGIS를 Supabase에 적재하면 별도 플래그로 DB 경로 전환.
  const dir = path.join(process.cwd(), "data-pipeline", "output");
  const schoolsPath = path.join(dir, "schools.json");
  const zonesPath = path.join(dir, "zones_sido11.json");
  fixtureCache = {
    schools: existsSync(schoolsPath)
      ? (JSON.parse(readFileSync(schoolsPath, "utf8")) as SchoolFixture[])
      : undefined,
    zones: existsSync(zonesPath)
      ? (JSON.parse(readFileSync(zonesPath, "utf8")) as ZoneCollection)
      : undefined,
  };
  return fixtureCache;
}

/**
 * 주문의 리포트를 생성한다.
 *
 * @returns 생성된 Report (reviewStatus=pending). 검수는 5d(admin)에서.
 * @throws 주문이 paid 상태가 아니거나 생성 중 오류
 */
export async function generateReportForOrder(orderId: string): Promise<Report> {
  const store = getOrderStore();
  const order = await store.getOrder(orderId);
  if (!order) throw new Error(`주문 없음: ${orderId}`);
  if (order.status !== "paid" && order.status !== "rejected") {
    throw new Error(`생성 가능 상태가 아닙니다: ${order.status}`);
  }

  await store.updateOrderStatus(orderId, "generating");

  try {
    const subjectRow = await store.getSubject(order.subjectId);
    if (!subjectRow) throw new Error("자녀 정보 없음");

    // PII 복호화 — 이 스코프 안에서만 평문 사용
    const subject = decryptSubject(subjectRow);
    const { schools, zones } = loadFixtures();

    const built = await buildReportForSubject(subject, order.tier, {
      fixtureSchools: schools,
      fixtureZones: zones,
      subjectLabel: buildSubjectLabel(subject),
    });

    const report = await store.createReport({
      orderId,
      markdown: built.markdown,
      html: built.html,
      tier: built.tier,
      reviewStatus: "pending",
      reviewNote: null,
      pdfUrl: null,
    });

    await store.setOrderReport(orderId, report.id);
    await store.updateOrderStatus(orderId, "review");
    return report;
  } catch (e) {
    await store.updateOrderStatus(orderId, "failed");
    throw e;
  }
}

/** 표지 라벨 — PII를 최소 노출 (연·월·일·성별까지만, 분 단위 시각 제외) */
function buildSubjectLabel(s: ReturnType<typeof decryptSubject>): string {
  const g = s.gender === "female" ? "여아" : "남아";
  const time = s.birthHour != null ? ` ${s.birthHour}시` : " (시간 모름)";
  return `${s.birthYear}년 ${s.birthMonth}월 ${s.birthDay}일${time} · ${g}`;
}

/** 생성 가능한(paid/rejected) 주문 여부 — 트리거 API에서 사용 */
export function isGeneratable(order: Order): boolean {
  return order.status === "paid" || order.status === "rejected";
}
