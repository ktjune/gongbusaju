-- 006_enable_rls.sql
-- public 스키마의 모든 테이블에 Row-Level Security(RLS)를 켠다.
--
-- 왜: Supabase 보안 점검(2026-10-11)이 "rls_disabled_in_public — Critical"을 보고했다.
-- 로그인 때문에 브라우저에 공개되는 anon 키로 Supabase REST(PostgREST)를 부르면,
-- RLS가 꺼진 public 테이블(orders·subjects·reports·…)은 누구나 읽고·고치고·지울 수 있다.
--
-- 앱은 영향받지 않는다: 모든 DB 접근은 서버의 Prisma가 테이블 소유자(postgres) 권한으로
-- 하며, 소유자는 RLS를 우회한다(FORCE를 걸지 않으므로). anon 키로 테이블을 직접 읽는
-- 코드는 없다(인증은 Supabase Auth의 auth 스키마만 쓴다).
-- 정책(policy)을 하나도 만들지 않으므로 anon/authenticated 역할의 접근은 전부 거부된다.
--
-- spatial_ref_sys는 PostGIS 시스템 테이블이라 supabase_admin 소유 — 변경할 수 없고 데이터도 공개 표준값뿐이다.
--
-- 실행: Supabase 대시보드 → SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- 확인: Advisors → Security 에서 rls_disabled_in_public 경고가 사라지는지.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 앞으로 새로 만드는 테이블에도 잊지 않도록, 확인용 조회:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
