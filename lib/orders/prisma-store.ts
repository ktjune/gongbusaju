/**
 * lib/orders/prisma-store.ts
 * OrderStore의 Prisma(Supabase Postgres) 구현 — 프로덕션 영속화.
 *
 * InMemoryOrderStore와 동일한 인터페이스. DATABASE_URL이 있으면 getOrderStore()가
 * 이걸 반환한다. 도메인 타입(문자열 ISO 시각)과 Prisma row(DateTime) 사이를 변환한다.
 */

import { getPrisma } from "../db";
import { encryptPiiNullable, decryptPiiCompat } from "../crypto/pii";
import { newReportToken } from "./store";
import { AUTO_RECOVERED_PREFIX } from "../notify";
import type { OrderStore } from "./store";
import type { Order, NewOrder, OrderStatus, Report, Subject } from "./types";

const iso = (d: Date): string => d.toISOString();

// ── row → 도메인 매퍼 ────────────────────────────────────────
type OrderRow = {
  id: string; tier: string; status: string; subjectId: string;
  reportId: string | null; userId: string | null;
  paymentKey: string | null; refundedAt: Date | null; refundReason: string | null;
  refundRequestedAt: Date | null; refundRequestReason: string | null;
  notifyError: string | null; notifyFailedAt: Date | null;
  notifyDeliveredAt: Date | null; notifyAuditedAt: Date | null;
  buyerName: string | null;
  contactEmail: string | null; contactPhone: string | null;
  generateAttempts: number;
  amountKrw: number | null;
  utmSource: string | null; utmMedium: string | null;
  utmCampaign: string | null; utmContent: string | null;
  referrer: string | null; landingPath: string | null;
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
    refundRequestedAt: r.refundRequestedAt ? iso(r.refundRequestedAt) : null,
    refundRequestReason: r.refundRequestReason,
    notifyError: r.notifyError,
    notifyFailedAt: r.notifyFailedAt ? iso(r.notifyFailedAt) : null,
    notifyDeliveredAt: r.notifyDeliveredAt ? iso(r.notifyDeliveredAt) : null,
    notifyAuditedAt: r.notifyAuditedAt ? iso(r.notifyAuditedAt) : null,
    generateAttempts: r.generateAttempts,
    // 연락처는 암호화 저장 — 읽을 때 복호화(레거시 평문도 호환)
    buyerName: decryptPiiCompat(r.buyerName),
    contactEmail: decryptPiiCompat(r.contactEmail),
    contactPhone: decryptPiiCompat(r.contactPhone),
    // 유입 경로는 개인정보가 아니라 암호화하지 않는다 — 어드민에서 집계해야 한다
    amountKrw: r.amountKrw,
    utmSource: r.utmSource,
    utmMedium: r.utmMedium,
    utmCampaign: r.utmCampaign,
    utmContent: r.utmContent,
    referrer: r.referrer,
    landingPath: r.landingPath,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

type SubjectRow = {
  id: string; encBirthYear: string; encBirthMonth: string; encBirthDay: string;
  encBirthHour: string | null; encBirthMinute: string | null; encGender: string;
  encAddress: string | null; encCurrentSchool: string | null;
  encName: string | null; encNameHanja: string | null;
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
    encName: r.encName,
    encNameHanja: r.encNameHanja,
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
  async createOrder(data: NewOrder): Promise<Order> {
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
        buyerName: encryptPiiNullable(data.buyerName),
        contactEmail: encryptPiiNullable(data.contactEmail),
        contactPhone: encryptPiiNullable(data.contactPhone),
        amountKrw: data.amountKrw,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmContent: data.utmContent,
        referrer: data.referrer,
        landingPath: data.landingPath,
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

  async requestRefund(id: string, reason: string): Promise<Order> {
    const row = await this.db.order.update({
      where: { id },
      data: { refundRequestedAt: new Date(), refundRequestReason: reason },
    });
    return toOrder(row);
  }

  async listRefundRequests(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { refundRequestedAt: { not: null }, status: { not: "refunded" } },
      orderBy: { refundRequestedAt: "desc" },
    });
    return rows.map(toOrder);
  }

  async getOrderByPaymentKey(paymentKey: string): Promise<Order | null> {
    const row = await this.db.order.findFirst({ where: { paymentKey } });
    return row ? toOrder(row) : null;
  }

  async recordNotifyResult(id: string, error: string | null): Promise<Order> {
    const row = await this.db.order.update({
      where: { id },
      data: {
        notifyError: error,
        notifyFailedAt: error ? new Date() : null,
        // 새 발송이 나갔다 — 이번 건의 수신 여부는 처음부터 다시 확인한다.
        // 옛 확인이 남으면 이번 발송이 실패해도 웹훅·감사가 모두 건너뛴다.
        notifyDeliveredAt: null,
        notifyAuditedAt: null,
      },
    });
    return toOrder(row);
  }

  async recordNotifyDelivery(
    id: string,
    result: { deliveredAt: Date | null; error: string | null }
  ): Promise<Order | null> {
    // 웹훅은 우리가 모르는 주문 식별자를 들고 올 수 있다(테스트 발송·옛 주문) — 조용히 무시.
    const exists = await this.db.order.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return null;

    const row = await this.db.order.update({
      where: { id },
      data: {
        notifyDeliveredAt: result.deliveredAt,
        notifyError: result.error,
        notifyFailedAt: result.error ? new Date() : null,
      },
    });
    return toOrder(row);
  }

  async listUnconfirmedNotifies(publishedBefore: Date): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: {
        status: "published",
        OR: [{ contactPhone: { not: null } }, { contactEmail: { not: null } }],
        notifyDeliveredAt: null,
        notifyAuditedAt: null,
        updatedAt: { lt: publishedBefore },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrder);
  }

  async markNotifyAudited(id: string): Promise<void> {
    await this.db.order.update({ where: { id }, data: { notifyAuditedAt: new Date() } });
  }

  async recordGenerateAttempt(id: string): Promise<number> {
    const row = await this.db.order.update({
      where: { id },
      data: { generateAttempts: { increment: 1 } },
    });
    return row.generateAttempts;
  }

  async exhaustGenerateAttempts(id: string, to: number): Promise<void> {
    await this.db.order.update({
      where: { id },
      data: { generateAttempts: to },
    });
  }

  async listNotifyFailures(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: {
        notifyError: { not: null },
        // 자동으로 되살린 건은 사람이 할 일이 없다 — 큐에 남기면 재발송을 눌러
        // 고객이 같은 안내를 두 번 받는다. 사실은 발송 완료 목록에 그대로 보인다.
        NOT: { notifyError: { startsWith: AUTO_RECOVERED_PREFIX } },
      },
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
        encName: data.encName,
        encNameHanja: data.encNameHanja,
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
    patch: Partial<Pick<Report, "markdown" | "html" | "reviewStatus" | "reviewNote" | "pdfUrl">>
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
