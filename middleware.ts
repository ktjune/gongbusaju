/**
 * middleware.ts — admin 인증
 *
 * /admin 및 /api/admin/* 경로를 HTTP Basic Auth로 보호한다.
 *
 * 환경변수:
 *   ADMIN_PASSWORD=<비밀번호>  (Vercel env: vercel env add ADMIN_PASSWORD)
 *
 * 미설정 동작:
 *   - 개발(NODE_ENV=development): 인증 없이 통과 (로컬 편의)
 *   - 프로덕션: 503 반환 (운영자 설정 오류 방지)
 */

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Admin not configured. Set ADMIN_PASSWORD environment variable.",
        { status: 503 }
      );
    }
    // 개발 환경: 패스워드 미설정 시 통과
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const colonIdx = decoded.indexOf(":");
      const inputPassword = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      if (inputPassword === password) {
        return NextResponse.next();
      }
    } catch {
      // base64 디코딩 실패 → 401 반환
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="공부사주 Admin", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
