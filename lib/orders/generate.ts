/**
 * lib/orders/generate.ts
 * 주문 → 리포트 생성 오케스트레이션 (자동 QA → 자동 승인/검수 대기까지)
 *
 * 흐름: paid → generating → (사주계산+학교조회+리포트+렌더) → review
 *   - 자녀 PII는 여기서만 복호화해 메모리에서 사용, 즉시 폐기.
 *   - 생성된 리포트는 자동 QA(runReportQa)를 거친다.
 *     · QA 통과 → 즉시 자동 승인(approveReport) → published, 보호자 발송.
 *     · QA 실패 → 1회 재생성 후 재검사. 그래도 실패하면 reviewStatus=pending으로
 *       남겨 사람이 어드민 "검수 큐"에서 확인 (reviewNote에 QA 사유 기록).
 *   - lib/report.buildReportForSubject가 saju·schools 합류를 담당 → orders는
 *     saju·schools를 직접 import하지 않는다.
 *
 * [데모] DATABASE_URL 없으면 data-pipeline 산출물(서울 통학구역·전국 학교)을
 * 픽스처로 로드해 배정 학교를 채운다. 프로덕션은 PostGIS 경로.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { buildReportForSubject, runAutoQa } from "../report";
import type { SchoolFixture, ZoneCollection } from "../schools";
import { getOrderStore } from "./store";
import { decryptSubject } from "./index";
import { approveReport } from "./review";
import type { Order, Report } from "./types";

// 픽스처는 한 번만 읽어 캐시 (DATABASE_URL 없는 로컬 개��� 전용)
let fixtureCache: { schools?: SchoolFixture[]; zones?: ZoneCollection } | null = null;

function loadFixtures(): { schools?: SchoolFixture[]; zones?: ZoneCollection } {
  if (fixtureCache) return fixtureCache;
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
  // published: 어드민이 발송 후에도 개선된 내용으로 재생성(재발송) 가능.
  // generating: 타임아웃으로 고착된 경우 재생성으로 복구.
  if (
    order.status !== "paid" &&
    order.status !== "rejected" &&
    order.status !== "failed" &&
    order.status !== "generating" &&
    order.status !== "published"
  ) {
    throw new Error(`생성 가능 상태가 아닙니다: ${order.status}`);
  }

  await store.updateOrderStatus(orderId, "generating");

  try {
    const subjectRow = await store.getSubject(order.subjectId);
    if (!subjectRow) throw new Error("자녀 정보 없음");

    // PII 복호화 — 이 스코프 안에서만 평문 사용
    const subject = decryptSubject(subjectRow);

    // 학교 조회 경로 결정:
    //   DATABASE_URL 있음 → PostGIS DB 모드 (fixtureSchools/Zones 미전달)
    //   DATABASE_URL 없음 → 로컬 픽스처 파일 (개발 환경)
    const useDb = !!process.env.DATABASE_URL;
    const { schools, zones } = useDb ? {} : loadFixtures();

    const buildOpts = {
      fixtureSchools: schools,
      fixtureZones: zones,
      subjectLabel: buildSubjectLabel(subject),
    };

    let built = await buildReportForSubject(subject, buildOpts);

    // 금지 표현(가드레일) 감지 시 1회 재생성 시도 — LLM 단어 선택 문제는 대개 재생성으로 해소.
    // 그래도 남으면 하드 실패시키지 않고 사람 검수로 보낸다(유료 주문 유실 방지).
    if (built.guardrailViolations.length > 0) {
      console.warn(
        `[order] 가드레일 위반 — 재생성 시도: 주문 ${orderId}`,
        built.guardrailViolations.map((v) => v.reason)
      );
      const retry = await buildReportForSubject(subject, buildOpts);
      if (retry.guardrailViolations.length <= built.guardrailViolations.length) {
        built = retry;
      }
    }
    const guardrailFailed = built.guardrailViolations.length > 0;

    // 자동 QA는 LLM 산문만 검수한다 (코드가 만든 표·칩·도식·면책은 제외)
    const qa = await runAutoQa(built.prose);
    // 자동 발행 조건: QA 통과 + 가드레일 위반 없음(법적 안전). 하나라도 걸리면 사람 검수로.
    const autoApprovable = qa.passed && !guardrailFailed;

    if (!autoApprovable) {
      console.warn(
        `[order] 자동 승인 보류 — 사람 검수 대기: 주문 ${orderId}`,
        guardrailFailed ? built.guardrailViolations.map((v) => v.reason) : qa.issues
      );
    }

    const noteParts: string[] = [];
    if (!qa.passed) noteParts.push(`[자동 QA] ${qa.issues.join(" / ")}`);
    if (guardrailFailed) {
      noteParts.push(`[가드레일] ${built.guardrailViolations.map((v) => v.reason).join(" / ")}`);
    }

    const report = await store.createReport({
      orderId,
      markdown: built.markdown,
      html: built.html,
      tier: order.tier,
      reviewStatus: "pending",
      reviewNote: autoApprovable ? null : noteParts.join(" · "),
      pdfUrl: null,
    });

    await store.setOrderReport(orderId, report.id);
    await store.updateOrderStatus(orderId, "review");

    // QA 통과 + 가드레일 OK → 사람 검수 없이 자동 승인·발행 (보호자 발송 포함)
    if (autoApprovable) {
      return await approveReport(report.id);
    }
    return report;
  } catch (e) {
    await store.updateOrderStatus(orderId, "failed");
    // 에러 상세를 명시적으로 직렬화해 Vercel 로그가 잘리지 않게 함
    console.error(`[order] 생성 실패 — 주문: ${orderId}`);
    if (e instanceof Error) {
      console.error(`[order] 에러 메시지: ${e.message}`);
      if (e.stack) console.error(`[order] 스택: ${e.stack}`);
    } else {
      console.error(`[order] 에러: ${String(e)}`);
    }
    throw e;
  }
}

/** 표지 라벨 — PII를 최소 노출 (연·월·일·성별까지만, 분 단위 시각 제외) */
function buildSubjectLabel(s: ReturnType<typeof decryptSubject>): string {
  const g = s.gender === "female" ? "여아" : "남아";
  const time = s.birthHour != null ? ` ${s.birthHour}시` : " (시간 모름)";
  return `${s.birthYear}년 ${s.birthMonth}월 ${s.birthDay}일${time} · ${g}`;
}

/** 생성 가능한 주문 여부 — 트리거 API에서 사용. published는 발송 후 재생성(재발송)용 */
export function isGeneratable(order: Order): boolean {
  return (
    order.status === "paid" ||
    order.status === "rejected" ||
    order.status === "failed" ||
    order.status === "generating" ||
    order.status === "published"
  );
}
