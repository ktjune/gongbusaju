import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버리스 함수 번들에 학교 데이터 픽스처를 포함한다.
  // lib/orders/generate.ts가 런타임에 fs로 읽으므로, Next 트레이서가
  // 자동 포함하지 못한다 → 명시적으로 추가 (없으면 Vercel에서 ENOENT).
  outputFileTracingIncludes: {
    "/api/generate-trigger": [
      "./data-pipeline/output/schools.json",
      "./data-pipeline/output/zones_sido11.json",
    ],
  },
};

export default nextConfig;
