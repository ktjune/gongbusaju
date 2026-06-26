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
  // @sparticuz/chromium, puppeteer-core: 번들링 제외 → 런타임 require 사용
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

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
    // @sparticuz/chromium 의 bin(압축된 크로미움 바이너리)을 PDF 라우트 함수에 포함.
    // externalize만으로는 런타임 경로 로드를 트레이서가 못 따라가 bin이 누락된다.
    "/result/[token]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
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
