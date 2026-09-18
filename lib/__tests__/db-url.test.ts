import { describe, it, expect } from "vitest";
import { toServerlessPoolerUrl } from "../db-url";

const HOST = "aws-1-ap-northeast-2.pooler.supabase.com";

describe("toServerlessPoolerUrl", () => {
  it("세션 풀러(5432) → 트랜잭션 풀러(6543) + pgbouncer", () => {
    expect(toServerlessPoolerUrl(`postgresql://postgres.abc:pw@${HOST}:5432/postgres`)).toBe(
      `postgresql://postgres.abc:pw@${HOST}:6543/postgres?pgbouncer=true`
    );
  });

  it("비밀번호의 특수문자를 건드리지 않는다", () => {
    const pw = "p@ss:w/o+rd=%21#x";
    const url = `postgresql://postgres.abc:${pw}@${HOST}:5432/postgres`;
    const out = toServerlessPoolerUrl(url)!;
    expect(out.slice(0, out.lastIndexOf("@"))).toBe(url.slice(0, url.lastIndexOf("@")));
  });

  it("기존 쿼리 파라미터를 보존한다", () => {
    expect(toServerlessPoolerUrl(`postgresql://u:p@${HOST}:5432/postgres?sslmode=require`)).toBe(
      `postgresql://u:p@${HOST}:6543/postgres?sslmode=require&pgbouncer=true`
    );
  });

  it("이미 6543이면 그대로 둔다", () => {
    const u = `postgresql://u:p@${HOST}:6543/postgres?pgbouncer=true`;
    expect(toServerlessPoolerUrl(u)).toBe(u);
  });

  it("풀러가 아닌 호스트(직접 연결)는 그대로 둔다", () => {
    const u = "postgresql://u:p@db.abc.supabase.co:5432/postgres";
    expect(toServerlessPoolerUrl(u)).toBe(u);
  });

  it("DB_POOLER_MODE=session 이면 되돌린다", () => {
    const u = `postgresql://u:p@${HOST}:5432/postgres`;
    expect(toServerlessPoolerUrl(u, "session")).toBe(u);
  });

  it("미설정·이상한 값이어도 터지지 않는다", () => {
    expect(toServerlessPoolerUrl(undefined)).toBeUndefined();
    expect(toServerlessPoolerUrl("not-a-url")).toBe("not-a-url");
  });
});
