/**
 * GET /sample — 맛보기(공개) 샘플 리포트
 *
 * 실제 리포트와 동일한 디자인·코드 경로로 렌더된 전체 리포트를 그대로 보여준다.
 * 랜딩의 "리포트 전체 예시 보기" 링크 대상. 개인정보 없는 샘플 데이터.
 *
 * Node 런타임 필수(리포트 생성이 node 모듈 사용). 콘텐츠가 고정이라 정적 캐시.
 */

import { buildSampleReport } from "@/lib/report/sample";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  // gated: 앞 6개 섹션만 공개 + 복사 방어막 주입 (전체 유출 방지)
  const { html } = await buildSampleReport({ gated: true });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      // 검색·AI 크롤러 색인 제외 (robots.txt와 이중 차단)
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
