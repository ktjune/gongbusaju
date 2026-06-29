/**
 * lib/orders/prisma-store.ts
 * OrderStore의 Prisma(Supabase Postgres) 구현 — 프로덕션 영속화.
 *
 * InMemoryOrderStore와 동일한 인터페이스. DATABASE_URL이 있으면 getOrderStore()가
 * 이걸 반환한다. 도메인 타입(문자열 ISO 시각)과 Prisma row(DateTime) 사이를 변환한다.
 */

import { getPrisma } from "../db";
import { newReportToken } from "./store";
import type { OrderStore } from "./store";
import type { Order, OrderStatus, Report, Subject } from "./types";

const iso = (d: Date): string => d.toISOString();

// ── row → 도메인 매퍼 ────────────────────────────────────────
type OrderRow = {
  id: string; tier: string; status: string; subjectId: string;
  reportId: string | null; userId: string | null;
  paymentKey: string | null; refundedAt: Date | null; refundReason: string | null;
  notifyError: string | null; notifyFailedAt: Date | null;
  contactEmail: string | null; contactPhone: string | null;
  createdAt: Date; updatedAt: Date;
};
function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    tier: r.tier as Order["tier"],
    status: r.status as OrderStatus,
    subjectId: r.subjectId,
    reportId: r.reportId,
    userId: r.userId,
    paymentKey: r.paymentKey,
    refundedAt: r.refundedAt ? iso(r.refundedAt) : null,
    refundReason: r.refundReason,
    notifyError: r.notifyError,
    notifyFailedAt: r.notifyFailedAt ? iso(r.notifyFailedAt) : null,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

type SubjectRow = {
  id: string; encBirthYear: string; encBirthMonth: string; encBirthDay: string;
  encBirthHour: string | null; encBirthMinute: string | null; encGender: string;
  encAddress: string | null; encCurrentSchool: string | null;
  consentAt: Date; retainUntil: Date; createdAt: Date;
};
function toSubject(r: SubjectRow): Subject {
  return {
    id: r.id,
    encBirthYear: r.encBirthYear,
    encBirthMonth: r.encBirthMonth,
    encBirthDay: r.encBirthDay,
    encBirthHour: r.encBirthHour,
    encBirthMinute: r.encBirthMinute,
    encGender: r.encGender,
    encAddress: r.encAddress,
    encCurrentSchool: r.encCurrentSchool,
    consentAt: iso(r.consentAt),
    retainUntil: iso(r.retainUntil),
    createdAt: iso(r.createdAt),
  };
}

type ReportRow = {
  id: string; orderId: string; token: string; tier: string;
  markdown: string; html: string; reviewStatus: string; reviewNote: string | null;
  pdfUrl: string | null; createdAt: Date; updatedAt: Date;
};
function toReport(r: ReportRow): Report {
  return {
    id: r.id,
    orderId: r.orderId,
    token: r.token,
    tier: r.tier as Report["tier"],
    markdown: r.markdown,
    html: r.html,
    reviewStatus: r.reviewStatus as Report["reviewStatus"],
    reviewNote: r.reviewNote,
    pdfUrl: r.pdfUrl,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

export class PrismaOrderStore implements OrderStore {
  private get db() {
    return getPrisma();
  }

  // ── 주문 ──
  async createOrder(
    data: Omit<Order, "id" | "createdAt" | "updatedAt">
  ): Promise<Order> {
    const row = await this.db.order.create({
      data: {
        tier: data.tier,
        status: data.status,
        subjectId: data.subjectId,
        reportId: data.reportId,
        userId: data.userId,
        paymentKey: data.paymentKey,
        refundedAt: data.refundedAt ? new Date(data.refundedAt) : null,
        refundReason: data.refundReason,
        notifyError: data.notifyError,
        notifyFailedAt: data.notifyFailedAt ? new Date(data.notifyFailedAt) : null,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
      },
    });
    return toOrder(row);
  }

  async getOrder(id: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({ where: { id } });
    return row ? toOrder(row) : null;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const row = await this.db.order.update({ where: { id }, data: { status } });
    return toOrder(row);
  }

  async setOrderReport(id: string, reportId: string): Promise<Order> {
    const row = await this.db.order.update({ where: { id }, data: { reportId } });
    return toOrder(row);
  }

  async refundOrder(id: string, reason: string): Promise<Order> {
    const row = await this.db.order.update({
      where: { id },
      data: { status: "refunded", refundedAt: new Date(), refundReason: reason },
    });
    return toOrder(row);
  }

  async recordNotifyResult(id: string, error: string | null): Promise<Order> {
    const row = await this.db.order.update({
      where: { id },
      data: { notifyError: error, notifyFailedAt: error ? new Date() : null },
    });
    return toOrder(row);
  }

  async listNotifyFailures(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { notifyError: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrder);
  }

  async listOrders(filter?: { status?: OrderStatus }): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: filter?.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrder);
  }

  // ── 자녀 PII ──
  async createSubject(
    data: Omit<Subject, "id" | "createdAt">
  ): Promise<Subject> {
    const row = await this.db.subject.create({
      data: {
        encBirthYear: data.encBirthYear,
        encBirthMonth: data.encBirthMonth,
        encBirthDay: data.encBirthDay,
        encBirthHour: data.encBirthHour,
        encBirthMinute: data.encBirthMinute,
        encGender: data.encGender,
        encAddress: data.encAddress,
        encCurrentSchool: data.encCurrentSchool,
        consentAt: new Date(data.consentAt),
        retainUntil: new Date(data.retainUntil),
      },
    });
    return toSubject(row);
  }

  async getSubject(id: string): Promise<Subject | null> {
    const row = await this.db.subject.findUnique({ where: { id } });
    return row ? toSubject(row) : null;
  }

  async deleteSubject(id: string): Promise<void> {
    await this.db.subject.delete({ where: { id } });
  }

  async deleteExpiredSubjects(nowIso: string): Promise<number> {
    const { count } = await this.db.subject.deleteMany({
      where: { retainUntil: { lt: new Date(nowIso) } },
    });
    return count;
  }

  // ── 리포트 ──
  async createReport(
    data: Omit<Report, "id" | "token" | "createdAt" | "updatedAt">
  ): Promise<Report> {
    const row = await this.db.report.create({
      data: {
        orderId: data.orderId,
        token: newReportToken(),
        tier: data.tier,
        markdown: data.markdown,
        html: data.html,
        reviewStatus: data.reviewStatus,
        reviewNote: data.reviewNote,
        pdfUrl: data.pdfUrl,
      },
    });
    return toReport(row);
  }

  async getReport(id: string): Promise<Report | null> {
    const row = await this.db.report.findUnique({ where: { id } });
    return row ? toReport(row) : null;
  }

  async getReportByToken(token: string): Promise<Report | null> {
    const row = await this.db.report.findUnique({ where: { token } });
    return row ? toReport(row) : null;
  }

  async updateReport(
    id: string,
    patch: Partial<Pick<Report, "markdown" | "reviewStatus" | "reviewNote" | "pdfUrl">>
  ): Promise<Report> {
    const row = await this.db.report.update({ where: { id }, data: patch });
    return toReport(row);
  }

  async listReports(filter?: {
    reviewStatus?: Report["reviewStatus"];
  }): Promise<Report[]> {
    const rows = await this.db.report.findMany({
      where: filter?.reviewStatus ? { reviewStatus: filter.reviewStatus } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toReport);
  }
}
