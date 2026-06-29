/**
 * lib/orders/store.ts
 * 주문·자녀·리포트 저장소 인터페이스 + 인메모리 구현
 *
 * 인터페이스 분리 이유: DATABASE_URL(Supabase/Prisma)이 준비되기 전까지
 * 인메모리 구현으로 전체 흐름(신청→생성→검수→발행)을 돌려보고,
 * 자격증명이 들어오면 PrismaOrderStore로 교체한다. UI·API는 인터페이스만 의존.
 *
 * [주의] 인메모리 구현은 단일 프로세스·휘발성 — 개발·테스트·데모 전용.
 * 서버 재시작 시 사라지고 서버리스 인스턴스 간 공유되지 않는다.
 */

import { randomBytes, randomUUID } from "node:crypto";
import type { Order, Subject, Report, OrderStatus } from "./types";
import { PrismaOrderStore } from "./prisma-store";

export interface OrderStore {
  // ── 주문 ──
  createOrder(data: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<Order>;
  setOrderReport(id: string, reportId: string): Promise<Order>;
  /** 환불 처리 — status=refunded + refundedAt/refundReason 기록 */
  refundOrder(id: string, reason: string): Promise<Order>;
  /** 결과 링크 발송 결과 기록 — error=null이면 성공(이전 실패 기록도 비움). */
  recordNotifyResult(id: string, error: string | null): Promise<Order>;
  listOrders(filter?: { status?: OrderStatus }): Promise<Order[]>;
  /** 발송 실패가 기록된(notifyError != null) 주문 목록 — 어드민 "발송 실패" 큐 */
  listNotifyFailures(): Promise<Order[]>;

  // ── 자녀 PII ──
  createSubject(data: Omit<Subject, "id" | "createdAt">): Promise<Subject>;
  getSubject(id: string): Promise<Subject | null>;
  deleteSubject(id: string): Promise<void>;
  /** retainUntil(보관기간 만료) < nowIso 인 Subject를 모두 삭제하고 삭제 건수를 반환한다. */
  deleteExpiredSubjects(nowIso: string): Promise<number>;

  // ── 리포트 ──
  createReport(
    data: Omit<Report, "id" | "token" | "createdAt" | "updatedAt">
  ): Promise<Report>;
  getReport(id: string): Promise<Report | null>;
  getReportByToken(token: string): Promise<Report | null>;
  updateReport(
    id: string,
    patch: Partial<Pick<Report, "markdown" | "reviewStatus" | "reviewNote" | "pdfUrl">>
  ): Promise<Report>;
  listReports(filter?: { reviewStatus?: Report["reviewStatus"] }): Promise<Report[]>;
}

/** 추측 불가 결과페이지 토큰 (URL-safe) */
export function newReportToken(): string {
  return randomBytes(24).toString("base64url");
}

const nowIso = () => new Date().toISOString();

/** 인메모리 저장소 — 개발·테스트·데모 전용 */
export class InMemoryOrderStore implements OrderStore {
  private orders = new Map<string, Order>();
  private subjects = new Map<string, Subject>();
  private reports = new Map<string, Report>();
  private tokenIndex = new Map<string, string>(); // token → reportId

  async createOrder(
    data: Omit<Order, "id" | "createdAt" | "updatedAt">
  ): Promise<Order> {
    const ts = nowIso();
    const order: Order = { ...data, id: randomUUID(), createdAt: ts, updatedAt: ts };
    this.orders.set(order.id, order);
    return order;
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error(`주문 없음: ${id}`);
    const updated = { ...order, status, updatedAt: nowIso() };
    this.orders.set(id, updated);
    return updated;
  }

  async setOrderReport(id: string, reportId: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error(`주문 없음: ${id}`);
    const updated = { ...order, reportId, updatedAt: nowIso() };
    this.orders.set(id, updated);
    return updated;
  }

  async refundOrder(id: string, reason: string): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error(`주문 없음: ${id}`);
    const ts = nowIso();
    const updated: Order = {
      ...order,
      status: "refunded",
      refundedAt: ts,
      refundReason: reason,
      updatedAt: ts,
    };
    this.orders.set(id, updated);
    return updated;
  }

  async recordNotifyResult(id: string, error: string | null): Promise<Order> {
    const order = this.orders.get(id);
    if (!order) throw new Error(`주문 없음: ${id}`);
    const updated: Order = {
      ...order,
      notifyError: error,
      notifyFailedAt: error ? nowIso() : null,
      updatedAt: nowIso(),
    };
    this.orders.set(id, updated);
    return updated;
  }

  async listOrders(filter?: { status?: OrderStatus }): Promise<Order[]> {
    const all = [...this.orders.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return filter?.status ? all.filter((o) => o.status === filter.status) : all;
  }

  async listNotifyFailures(): Promise<Order[]> {
    return [...this.orders.values()]
      .filter((o) => o.notifyError != null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSubject(data: Omit<Subject, "id" | "createdAt">): Promise<Subject> {
    const subject: Subject = { ...data, id: randomUUID(), createdAt: nowIso() };
    this.subjects.set(subject.id, subject);
    return subject;
  }

  async getSubject(id: string): Promise<Subject | null> {
    return this.subjects.get(id) ?? null;
  }

  async deleteSubject(id: string): Promise<void> {
    this.subjects.delete(id);
  }

  async deleteExpiredSubjects(nowIso: string): Promise<number> {
    const expired = [...this.subjects.values()].filter((s) => s.retainUntil < nowIso);
    for (const s of expired) this.subjects.delete(s.id);
    return expired.length;
  }

  async createReport(
    data: Omit<Report, "id" | "token" | "createdAt" | "updatedAt">
  ): Promise<Report> {
    const ts = nowIso();
    const report: Report = {
      ...data,
      id: randomUUID(),
      token: newReportToken(),
      createdAt: ts,
      updatedAt: ts,
    };
    this.reports.set(report.id, report);
    this.tokenIndex.set(report.token, report.id);
    return report;
  }

  async getReport(id: string): Promise<Report | null> {
    return this.reports.get(id) ?? null;
  }

  async getReportByToken(token: string): Promise<Report | null> {
    const id = this.tokenIndex.get(token);
    return id ? this.reports.get(id) ?? null : null;
  }

  async updateReport(
    id: string,
    patch: Partial<Pick<Report, "markdown" | "reviewStatus" | "reviewNote" | "pdfUrl">>
  ): Promise<Report> {
    const report = this.reports.get(id);
    if (!report) throw new Error(`리포트 없음: ${id}`);
    const updated = { ...report, ...patch, updatedAt: nowIso() };
    this.reports.set(id, updated);
    return updated;
  }

  async listReports(filter?: {
    reviewStatus?: Report["reviewStatus"];
  }): Promise<Report[]> {
    const all = [...this.reports.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return filter?.reviewStatus
      ? all.filter((r) => r.reviewStatus === filter.reviewStatus)
      : all;
  }
}

/**
 * 프로세스 전역 싱글턴 — 개발 중 Next.js HMR/라우트 간 동일 인스턴스 유지.
 * (globalThis에 보관해 모듈 리로드에도 살아남게 한다)
 */
const globalForStore = globalThis as unknown as { __orderStore?: OrderStore };

export function getOrderStore(): OrderStore {
  if (!globalForStore.__orderStore) {
    // DATABASE_URL 있으면 Supabase(Prisma) 영속화, 없으면 인메모리(개발/데모).
    // 모듈 import는 가벼움 — Prisma 클라이언트는 첫 쿼리 시점에만 생성된다.
    if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
      // 서버리스 인스턴스마다 메모리가 분리돼 있어 인메모리 스토어로는
      // "결제는 됐는데 다른 인스턴스에서 주문이 안 보이는" 사고가 난다 — 조용한 폴백 금지.
      throw new Error(
        "DATABASE_URL 미설정 — 프로덕션에서 인메모리 주문 저장소 사용 금지"
      );
    }
    globalForStore.__orderStore = process.env.DATABASE_URL
      ? new PrismaOrderStore()
      : new InMemoryOrderStore();
  }
  return globalForStore.__orderStore;
}
