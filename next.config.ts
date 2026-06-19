import type { NextConfig } from "next";

const securityHeaders = [
  // 클릭재킹 방지
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // MIME 스니핑 방지
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer 정보 최소화 (PII 보호)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 권한 정책 — 불필요한 브라우저 기능 차단
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS — HTTPS 강제 (1년, subdomains 포함)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // 서버리스 함수 번들에 학교 데이터 픽스처를 포함한다.
  // lib/orders/generate.ts가 런타임에 fs로 읽으므로, Next 트레이서가
  // 자동 포함하지 못한다 → 명시적으로 추가 (없으면 Vercel에서 ENOENT).
  outputFileTracingIncludes: {
    "/api/generate-trigger": [
      "./data-pipeline/output/schools.json",
      "./data-pipeline/output/zones_sido11.json",
    ],
    "/api/worker/run": [
      "./data-pipeline/output/schools.json",
      "./data-pipeline/output/zones_sido11.json",
    ],
    "/api/order": [
      "./data-pipeline/output/schools.json",
      "./data-pipeline/output/zones_sido11.json",
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
