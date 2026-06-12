/**
 * lib/db.ts
 * Prisma 클라이언트 싱글턴 (주문 흐름 영속화)
 *
 * DATABASE_URL이 있을 때만 생성한다. 개발 중 HMR로 인스턴스가 누적되지 않도록
 * globalThis에 보관한다. 학교 사실 레이어(PostGIS)는 별도 pg 경로를 쓰며 이 클라이언트와 무관.
 */

import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    // Prisma 7 생성 클라이언트는 런타임에 DATABASE_URL(prisma.config.ts datasource.url
    // 이 참조한 env)을 직접 읽는다. getOrderStore가 DATABASE_URL 있을 때만 생성.
    globalForPrisma.__prisma = new PrismaClient();
  }
  return globalForPrisma.__prisma;
}
