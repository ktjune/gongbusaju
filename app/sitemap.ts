import type { MetadataRoute } from "next";

/**
 * sitemap.xml — 검색엔진에 색인 대상 URL을 알린다.
 *
 * base를 하드코딩하면 안 된다. 도메인을 gongbusaju.kr로 옮긴 뒤에도
 * vercel.app이 그대로 남아 "정식 주소는 vercel.app"이라고 알리고 있었다.
 * layout.tsx의 metadataBase와 같은 값을 쓴다.
 *
 * 제외 대상: /login·/signup·/mypage(개인 영역), /order/result(결제 후 경유),
 * /admin·/api·/dev·/sample(robots.ts에서 이미 차단).
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gongbusaju.kr";

/** [경로, 우선순위] — 신청 전환 경로가 가장 높다 */
const ROUTES: [string, number][] = [
  ["", 1],
  ["/apply", 0.8],
  ["/refund", 0.4],
  ["/terms", 0.3],
  ["/privacy", 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(([path, priority]) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority,
  }));
}
