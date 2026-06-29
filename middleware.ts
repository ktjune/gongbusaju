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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

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
