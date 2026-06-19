/**
 * middleware.ts — admin 인증
 *
 * /admin 및 /api/admin/* 경로를 쿠키 기반으로 보호한다.
 * 로그인: POST /api/admin/login → Set-Cookie: admin_session
 * 로그아웃: POST /api/admin/logout
 *
 * 환경변수:
 *   ADMIN_PASSWORD=<비밀번호>
 *
 * 미설정 동작:
 *   - 개발(NODE_ENV=development): 인증 없이 통과
 *   - 프로덕션: 로그인 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/admin/login";
const COOKIE_NAME = "admin_session";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 로그인 API / 로그아웃 API는 미들웨어 통과
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;

  // 개발 환경 + 패스워드 미설정: 통과
  if (!password && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  // 로그인 페이지 자체는 통과
  if (pathname === LOGIN_PATH) {
    return NextResponse.next();
  }

  // 쿠키 검증
  const session = request.cookies.get(COOKIE_NAME)?.value;
  if (session === password) {
    return NextResponse.next();
  }

  // 미인증 → 로그인 페이지로 리다이렉트
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
