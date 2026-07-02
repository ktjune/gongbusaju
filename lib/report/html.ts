/**
 * lib/report/html.ts
 * 디자인된 리포트 HTML 렌더러
 *
 * 용도 (SPEC §11 전달 모델):
 * - 웹 결과페이지: 모바일(카톡 인앱 브라우저) 우선 — 카톡 공유는 토큰 링크로
 * - PDF: 같은 HTML을 브라우저 인쇄(A4)로 저장 — @media print 최적화 내장
 *
 * 마크다운(assembleReport 출력)을 본문으로 렌더링하고,
 * 표지(원국 카드)는 SajuResult에서 직접 디자인 HTML로 생성한다.
 * LLM 미관여 — 코드 결정론.
 */

import { marked } from "marked";
import type { SajuResult } from "../saju";
import { ganjiToHangul, stemElement, branchElement } from "../saju";
import { WUXING_COLOR } from "./charts";
import { objectParticle } from "./josa";

/** HTML 특수문자 이스케이프 — 이름 등 사용자 입력을 표지에 넣기 전 처리 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ──────────────────────────────────────────────────────────────
// 옵션
// ──────────────────────────────────────────────────────────────

export type RenderHtmlOptions = {
  /** 표지에 표시할 대상 라벨 (예: "2020년 9월 16일 16:43 출생 · 남아") */
  subjectLabel?: string;
  /** 아이 이름(한글, 선택) — 표지 제목·안내 호명용 */
  childName?: string;
  /** 아이 이름 한자(선택) — 표지 제목 병기용 */
  childNameHanja?: string;
  /** 발행일 표기 (기본: 오늘) */
  generatedAt?: string;
  /** 샘플 워터마크 문구 (지정 시 표지에 표시) */
  sampleNotice?: string;
};

// ──────────────────────────────────────────────────────────────
// 표지 — 원국 카드
// ──────────────────────────────────────────────────────────────

function pillarCard(
  pos: string,
  ganji: string | null,
  isDay: boolean
): string {
  if (!ganji) {
    return `<div class="pillar pillar-empty">
      <div class="pillar-pos">${pos}</div>
      <div class="pillar-char pillar-none">—</div>
      <div class="pillar-kr">시간 모름</div>
    </div>`;
  }
  const gan = ganji.charAt(0);
  const zhi = ganji.charAt(1);
  const kr = ganjiToHangul(ganji);
  const ganColor = WUXING_COLOR[stemElement(gan) ?? ""] ?? "#444";
  const zhiColor = WUXING_COLOR[branchElement(zhi) ?? ""] ?? "#444";
  return `<div class="pillar${isDay ? " pillar-day" : ""}">
    ${isDay ? `<div class="pillar-me">나</div>` : ""}
    <div class="pillar-pos">${pos}</div>
    <div class="pillar-char" style="color:${ganColor}">${gan}</div>
    <div class="pillar-char" style="color:${zhiColor}">${zhi}</div>
    <div class="pillar-kr">${kr}</div>
  </div>`;
}

function buildCover(saju: SajuResult, opts: RenderHtmlOptions): string {
  const { pillars } = saju;
  const date =
    opts.generatedAt ?? new Date().toISOString().slice(0, 10);

  // 이름이 있으면 "OO(한자)의", 없으면 "우리 아이의"로 자연 폴백
  const name = opts.childName?.trim();
  const hanja = opts.childNameHanja?.trim();
  const nameHtml = name
    ? `${escapeHtml(name)}${hanja ? `<span class="cover-hanja">${escapeHtml(hanja)}</span>` : ""}`
    : "";
  const titleLead = name ? `${nameHtml}의` : "우리 아이의";
  const hintWho = name
    ? `<b>${escapeHtml(name)}</b>${objectParticle(name)} 뜻하는 <b>일간</b>`
    : `아이 자신을 뜻하는 <b>일간</b>`;

  return `<header class="cover">
  ${opts.sampleNotice ? `<div class="sample-band">${opts.sampleNotice}</div>` : ""}
  <div class="cover-badge">공부·기질 사주 리포트</div>
  <h1 class="cover-title">${titleLead}<br>타고난 공부 결</h1>
  ${opts.subjectLabel ? `<p class="cover-subject">${opts.subjectLabel}</p>` : ""}
  <div class="pillars">
    ${pillarCard("時柱", pillars.hour, false)}
    ${pillarCard("日柱", pillars.day, true)}
    ${pillarCard("月柱", pillars.month, false)}
    ${pillarCard("年柱", pillars.year, false)}
  </div>
  <p class="cover-hint">가운데 강조된 기둥(日柱)의 윗글자가 ${hintWho}입니다.</p>
  <div class="cover-meta">
    <span class="meta-chip">발행 ${date}</span>
  </div>
  <p class="cover-note">본 리포트의 해석은 사주 명리의 관점이며, 실측 검사 결과가 아닙니다.</p>
</header>`;
}

// ──────────────────────────────────────────────────────────────
// 스타일
// ──────────────────────────────────────────────────────────────

const CSS = `
:root {
  --paper: #faf7f1;
  --card: #ffffff;
  --ink: #2c2c30;
  --ink-soft: #5a5f6a;
  --navy: #1f3b63;
  --navy-soft: #34507a;
  --gold: #b08c3e;
  --line: #e3ddd1;
  --callout-bg: #f3f6fb;
  --callout-line: #9db8d9;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
  font-size: 16px;
  line-height: 1.85;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.sheet { max-width: 720px; margin: 0 auto; padding: 0 20px 80px; }

/* ── 표지 ─────────────────────────────────────────── */
.cover { text-align: center; padding: 64px 0 48px; }
.sample-band {
  display: inline-block; background: #fff3cd; color: #7a5c00;
  border: 1px solid #e6d28a; border-radius: 6px;
  padding: 6px 14px; font-size: 0.82em; margin-bottom: 28px;
}
.cover-badge {
  display: inline-block; letter-spacing: 0.35em; text-indent: 0.35em;
  font-size: 0.8em; color: var(--gold); border-top: 1px solid var(--gold);
  border-bottom: 1px solid var(--gold); padding: 6px 4px; margin-bottom: 22px;
}
.cover-title {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 2.1em; line-height: 1.4; color: var(--navy); margin: 0 0 10px;
}
.cover-hanja { color: var(--gold); font-size: 0.62em; margin-left: 0.12em; vertical-align: 0.12em; }
.cover-subject { color: var(--ink-soft); margin: 0 0 36px; font-size: 0.95em; }
.pillars { display: flex; justify-content: center; gap: 10px; margin: 0 0 14px; }
.pillar {
  position: relative; background: var(--card); border: 1px solid var(--line);
  border-radius: 14px; padding: 14px 0 10px; width: 92px;
  box-shadow: 0 2px 10px rgba(31,59,99,0.06);
}
.pillar-day { border: 2px solid var(--navy); box-shadow: 0 4px 14px rgba(31,59,99,0.18); }
.pillar-me {
  position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
  background: var(--navy); color: #fff; font-size: 0.7em;
  padding: 2px 10px; border-radius: 10px;
}
.pillar-pos { font-size: 0.74em; color: var(--ink-soft); margin-bottom: 6px; }
.pillar-char {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 2em; line-height: 1.25; font-weight: 700;
}
.pillar-none { color: #b9b9b9; }
.pillar-kr { font-size: 0.78em; color: var(--ink-soft); margin-top: 6px; }
.pillar-empty { opacity: 0.75; }
.cover-hint { font-size: 0.85em; color: var(--ink-soft); margin: 0 0 30px; }
.cover-meta { margin-bottom: 10px; }
.meta-chip {
  display: inline-block; border: 1px solid var(--line); background: var(--card);
  border-radius: 20px; padding: 4px 14px; font-size: 0.8em;
  color: var(--ink-soft); margin: 0 3px;
}
.cover-note { font-size: 0.78em; color: #9a958c; }

/* ── 본문 ─────────────────────────────────────────── */
.report h2 {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 1.4em; color: var(--navy);
  margin: 2.4em 0 0.9em; padding: 14px 18px;
  background: var(--card); border-left: 6px solid var(--navy);
  border-radius: 0 12px 12px 0;
  box-shadow: 0 2px 8px rgba(31,59,99,0.07);
}
.report h3 {
  font-size: 1.12em; color: var(--navy-soft);
  margin: 1.9em 0 0.7em; padding-bottom: 6px;
  border-bottom: 2px solid var(--line);
}
.report h4 { color: var(--navy-soft); margin: 1.6em 0 0.6em; }
.report p { margin: 0.9em 0; }
.report strong { color: var(--navy); }
.report hr { border: none; margin: 44px 0; text-align: center; }
.report hr::after { content: "✦ ✦ ✦"; color: #cfc5b2; font-size: 0.8em; letter-spacing: 1.2em; text-indent: 1.2em; }
.report table {
  border-collapse: collapse; width: 100%; margin: 18px 0;
  font-size: 0.92em; background: var(--card);
  border-radius: 10px; overflow: hidden;
  box-shadow: 0 1px 6px rgba(31,59,99,0.06);
}
.report th, .report td { border: 1px solid var(--line); padding: 9px 12px; text-align: left; }
.report th { background: #efe9dd; color: var(--navy); font-weight: 600; }
.report tr:nth-child(even) td { background: #fbf9f5; }
.report blockquote {
  margin: 18px 0; padding: 12px 18px;
  background: var(--callout-bg); border-left: 4px solid var(--callout-line);
  border-radius: 0 10px 10px 0; color: #44505f; font-size: 0.93em;
}
.report blockquote p { margin: 0.3em 0; }
.report ul { padding-left: 22px; }
.report li { margin: 0.45em 0; }
.report svg { max-width: 100%; height: auto; display: block; margin: 22px auto; }

/* ── 모바일 (카톡 인앱 브라우저) ──────────────────── */
@media (max-width: 560px) {
  body { font-size: 15px; }
  .pillars { gap: 6px; }
  .pillar { width: 76px; border-radius: 11px; }
  .pillar-char { font-size: 1.6em; }
  .cover-title { font-size: 1.7em; }
  .report table { display: block; overflow-x: auto; white-space: nowrap; }
}

/* ── 인쇄/PDF (A4) ─────────────────────────────────── */
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body { background: #fff; font-size: 10.5pt; line-height: 1.7; }
  .sheet { max-width: none; padding: 0; }
  .cover { padding-top: 30mm; }
  .report h2 { break-before: page; box-shadow: none; }
  .report h2:first-of-type { break-before: page; }
  .report table, .report blockquote, .report svg { break-inside: avoid; }
  .report tr:nth-child(even) td { background: #fff; }
  a { color: inherit; text-decoration: none; }
  .print-btn { display: none; }
}

/* ── 인쇄 버튼 ─────────────────────────────────────── */
.print-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #1f3b63;
  color: #fff;
  border: none;
  border-radius: 50px;
  padding: 12px 22px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(31,59,99,0.25);
  z-index: 100;
  font-family: 'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
}
.print-btn:hover { background: #2a4f8a; }
`;

// ──────────────────────────────────────────────────────────────
// 렌더러
// ──────────────────────────────────────────────────────────────

/**
 * assembleReport() 마크다운 + SajuResult → 완성된 단일 HTML 문서.
 *
 * - 화면: 모바일 우선 디자인 (카톡 공유 링크로 열람)
 * - 인쇄: 브라우저 인쇄(Ctrl+P) → A4 PDF (섹션별 페이지 분리)
 */
export function renderReportHtml(
  saju: SajuResult,
  markdown: string,
  opts: RenderHtmlOptions = {}
): string {
  const cover = buildCover(saju, opts);
  const body = marked.parse(markdown, { async: false }) as string;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>공부 기질 사주 리포트</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">
${cover}
<main class="report">
${body}
</main>
</div>
<button class="print-btn" onclick="window.print()">PDF 저장 / 인쇄</button>
</body>
</html>`;
}
