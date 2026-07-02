/**
 * scripts/gen-real-report.ts — 검수용 실생성 리포트 (Gemini 실제 경로)
 * 실행: GEMINI_API_KEY=... npx tsx scripts/gen-real-report.ts
 * 커밋 금지(로컬 검수용).
 */
import { writeFileSync } from "node:fs";
import { buildReportForSubject } from "../lib/report";

async function main() {
  const t0 = Date.now();
  const built = await buildReportForSubject(
    {
      birthYear: 2014,
      birthMonth: 5,
      birthDay: 21,
      birthHour: 10,
      birthMinute: 30,
      gender: "female",
    },
    { currentYear: 2026, subjectLabel: "2014년 5월 21일 10:30 출생 · 여아 (만 12세, 초6)" }
  );
  writeFileSync("REAL_REPORT.md", built.markdown, "utf-8");
  console.log(`완료 ${(Date.now() - t0) / 1000}s / ${built.markdown.length}자 / demo=${built.isDemo}`);
}
main().catch((e) => { console.error("실패:", e.message); process.exit(1); });
