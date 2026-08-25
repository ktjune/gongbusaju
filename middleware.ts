/**
 * middleware.ts — Supabase 세션 갱신 + admin 인증 + /mypage 보호
 *
 * /admin 및 /api/admin/* 경로를 쿠키 기반으로 보호한다.
 * /mypage/* 는 Supabase Auth 로그인 필요.
 * 로그인: POST /api/admin/login → Set-Cookie: admin_session
 * 로그아웃: POST /api/admin/logout
 *
 * 환경변수:
 *   ADMIN_PASSWORD=<비밀번호>
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 미설정 동작:
 *   - 개발(NODE_ENV=development): 인증 없이 통과
 *   - 프로덕션: 로그인 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyAdminSessionToken } from "@/lib/auth/admin-session";

const LOGIN_PATH = "/admin/login";
const COOKIE_NAME = "admin_session";

/**
 * 옛 배포 주소 — 정식 도메인 연결 전에 쓰던 안정 별칭.
 * 여전히 200으로 같은 내용을 서빙해서 검색엔진에 중복 사이트로 보인다.
 *
 * 해시가 붙은 배포 주소(gongbusaju-xxxx.vercel.app)는 건드리지 않는다.
 * 프리뷰 배포 확인에 쓰이므로 리다이렉트하면 테스트가 막힌다. 그쪽은
 * layout.tsx의 canonical 태그가 정본을 알려주는 것으로 충분하다.
 */
const LEGACY_HOST = "gongbusaju.vercel.app";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── 옛 주소 → 정식 도메인 (색인 분산 방지) ──────────────────
  // API는 제외한다. 리다이렉트되면 POST 본문이 유실될 수 있다.
  if (
    request.headers.get("host") === LEGACY_HOST &&
    !pathname.startsWith("/api/")
  ) {
    const canonical = new URL(request.nextUrl);
    canonical.host = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gongbusaju.kr"
    ).host;
    canonical.protocol = "https:";
    return NextResponse.redirect(canonical, 308);
  }

  // ── Supabase 세션 갱신 (모든 요청) ─────────────────────────
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    await supabase.auth.getUser();
  }

  // ── /mypage 보호 — 로그인 필요 ──────────────────────────────
  if (pathname.startsWith("/mypage")) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return response; // 개발환경 통과
    }
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Admin 인증 ──────────────────────────────────────────────
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return response;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") {
    return response;
  }

  if (pathname === LOGIN_PATH) return response;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const session = request.cookies.get(COOKIE_NAME)?.value;
    if (!(await verifyAdminSessionToken(session, password))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = LOGIN_PATH;
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/mypage/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
