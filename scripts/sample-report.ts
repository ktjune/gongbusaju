/**
 * scripts/sample-report.ts
 * 샘플 리포트 파일 생성 — 결과물 미리보기·검수·diff 용
 *
 * 실행: npx tsx scripts/sample-report.ts
 *
 * 실제 빌드 로직은 lib/report/sample.ts(buildSampleReport)에 있으며,
 * 웹 라우트 app/sample 과 동일한 결과물을 공유한다. 이 스크립트는 그 결과를
 * SAMPLE_REPORT.md / SAMPLE_REPORT.html 파일로 떨어뜨리는 얇은 래퍼다.
 */

import { writeFileSync } from "node:fs";
import { buildSampleReport } from "../lib/report/sample";

async function main() {
  const { markdown, html } = await buildSampleReport();
  writeFileSync("SAMPLE_REPORT.md", markdown + "\n", "utf-8");
  writeFileSync("SAMPLE_REPORT.html", html, "utf-8");

  console.log(`분량: ${(markdown.length + 1).toLocaleString()}자 (공백 포함)`);
  console.log("→ SAMPLE_REPORT.md / SAMPLE_REPORT.html 저장 완료 (guardrails 통과)");
}

main().catch((e) => {
  console.error("생성 실패:", e.message);
  process.exit(1);
});
