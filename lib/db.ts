/**
 * lib/db.ts
 * Prisma 클라이언트 싱글턴 (주문 흐름 영속화)
 *
 * DATABASE_URL이 있을 때만 생성한다. 개발 중 HMR로 인스턴스가 누적되지 않도록
 * globalThis에 보관한다. 학교 사실 레이어(PostGIS)는 별도 pg 경로를 쓰며 이 클라이언트와 무관.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { toServerlessPoolerUrl } from "./db-url";
import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    // Prisma 7은 드라이버 어댑터가 기본 — pg 어댑터에 연결 문자열을 넘긴다.
    // getOrderStore가 DATABASE_URL 있을 때만 이 함수를 호출한다.
    // 서버리스는 요청마다 인스턴스가 늘어난다. 인스턴스당 연결 수를 묶지 않으면
    // Supabase 풀러의 자리를 idle 상태로 오래 붙들어, 다음 요청이 빈자리를 기다린다.
    // (2026-09-18 실측: pg_stat_activity에 Supavisor idle 연결 15개 = 세션 모드 한도 전부,
    //  5분 넘게 유휴. 어드민이 8개 API를 동시에 부르면서 특히 잘 드러났다.)
    const adapter = new PrismaPg({
      connectionString: toServerlessPoolerUrl(process.env.DATABASE_URL, process.env.DB_POOLER_MODE),
      max: 3,
      // 놀고 있는 연결은 빨리 반납한다
      idleTimeoutMillis: 10_000,
      // 자리가 안 나면 매달리지 말고 실패시킨다 — 30초 멈춘 화면보다 낫다
      connectionTimeoutMillis: 8_000,
    });
    globalForPrisma.__prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__prisma;
}
