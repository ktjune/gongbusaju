import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// .env.local(우선) → .env 순으로 로드 (Next 관례와 공유)
loadEnv({ path: ".env.local" });
loadEnv();

// 스키마·마이그레이션은 db/ 에 둔다 (SPEC §4 레포 구조).
// url은 env() 대신 process.env로 — 미설정 시에도 `prisma generate`가 동작하도록.
export default defineConfig({
  schema: path.join("db", "schema.prisma"),
  migrations: { path: path.join("db", "migrations") },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
