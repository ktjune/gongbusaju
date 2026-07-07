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

/** 오행(한글 키) → 대표 색 — 표지 강조선용 */
const ELEMENT_COLOR: Record<string, string> = {
  목: "#3d9a50", 화: "#d64545", 토: "#c9a227", 금: "#8e9aa8", 수: "#3b6fb5",
};

function buildCover(saju: SajuResult, opts: RenderHtmlOptions): string {
  const { pillars } = saju;
  const date =
    opts.generatedAt ?? new Date().toISOString().slice(0, 10);

  // 가장 강한 오행 색으로 표지 강조선 — 아이마다 표지 포인트 색이 달라진다
  const strongestEl = (Object.entries(saju.elements) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const accentColor = ELEMENT_COLOR[strongestEl ?? ""] ?? "var(--gold)";

  // 이름이 있으면 "OO의", 없으면 "우리 아이의"로 자연 폴백
  const name = opts.childName?.trim();
  const titleLead = name ? `${escapeHtml(name)}의` : "우리 아이의";
  const hintWho = name
    ? `<b>${escapeHtml(name)}</b>${objectParticle(name)} 뜻하는 <b>일간</b>`
    : `아이 자신을 뜻하는 <b>일간</b>`;

  return `<header class="cover">
  ${opts.sampleNotice ? `<div class="sample-band">${opts.sampleNotice}</div>` : ""}
  <div class="cover-badge">공부·기질 사주 리포트</div>
  <h1 class="cover-title">${titleLead}<br>타고난 공부 결</h1>
  <div class="cover-accent" style="background:${accentColor}"></div>
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
.cover-accent { width: 46px; height: 4px; border-radius: 2px; margin: 4px auto 16px; }
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
.report { counter-reset: h2c; }
.report h2 {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 1.4em; color: var(--navy);
  margin: 2.4em 0 0.9em; padding: 12px 18px 14px;
  background: var(--card); border-left: 6px solid var(--navy);
  border-radius: 0 12px 12px 0;
  box-shadow: 0 2px 8px rgba(31,59,99,0.07);
}
.report h2::before {
  counter-increment: h2c;
  content: counter(h2c, decimal-leading-zero);
  display: block;
  font-family: 'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-size: 0.5em; font-weight: 700; letter-spacing: 0.14em;
  color: var(--gold); margin-bottom: 2px;
}
.report h3 {
  font-size: 1.12em; color: var(--navy-soft);
  margin: 1.9em 0 0.7em; padding-bottom: 6px;
  border-bottom: 2px solid var(--line);
}
.report h4 { color: var(--navy-soft); margin: 1.6em 0 0.6em; }
.report p { margin: 0.9em 0; }
.report strong {
  color: var(--navy);
  background: linear-gradient(180deg, transparent 62%, #f6e6bd 62%);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* 표지·제목·오행 칩 안의 굵은 글씨엔 형광펜을 넣지 않는다 */
.report h2 strong, .report h3 strong, .report h4 strong,
.report th strong, .imagery-form strong, .wx-item strong,
.report table.maptable strong { background: none; }
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
/* 콜아웃 ① 팁·안내 (골드) */
.report blockquote {
  margin: 18px 0; padding: 12px 16px 12px 18px;
  background: #fbf5e8; border-left: 4px solid var(--gold);
  border-radius: 0 10px 10px 0; color: #5c4f36; font-size: 0.93em;
}
.report blockquote p { margin: 0.3em 0; }
/* 콜아웃 ② 데이터·출처·각주 (회색, 작게) */
.report .datanote {
  margin: 12px 0; padding: 8px 12px;
  background: #f3f1ea; border-radius: 8px;
  color: var(--ink-soft); font-size: 0.82em; line-height: 1.6;
}

/* ── 챕터 구분자 (배경 일러스트 + 제목) ─────────── */
.chapter-divider {
  position: relative; overflow: hidden;
  background: #f9f3e7; border-radius: 16px;
  margin: 48px 0 24px; padding: 34px 24px;
  text-align: center;
}
.chapter-bg {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 340px; max-width: 104%; opacity: 0.42;
  -webkit-mask-image: radial-gradient(ellipse 82% 80% at 50% 50%, #000 52%, transparent 90%);
  mask-image: radial-gradient(ellipse 82% 80% at 50% 50%, #000 52%, transparent 90%);
  pointer-events: none; user-select: none;
}
.chapter-inner { position: relative; }
.chapter-num {
  font-size: 0.74em; letter-spacing: 0.3em; text-indent: 0.3em;
  color: var(--gold); font-weight: 700;
}
.chapter-title {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 1.9em; font-weight: 700; color: var(--navy);
  margin: 8px 0 6px; line-height: 1.3;
}
.chapter-sub { color: var(--ink-soft); font-size: 0.9em; }

/* ── 한 장 요약 형상 히어로 카드 ─────────────────── */
.imagery-card {
  background: #f9f3e7;
  border: 1px solid var(--gold);
  border-radius: 16px;
  padding: 18px 26px 24px;
  margin: 22px 0;
  text-align: center;
  box-shadow: 0 4px 22px rgba(31,59,99,0.08);
}
.imagery-illust { margin: 0 0 4px; }
.imagery-img {
  width: 300px; max-width: 90%; height: auto; display: block; margin: 0 auto;
  /* 배경(크림)과 같은 색이라 자연스럽게 녹아들고, 가장자리만 살짝 페더링 */
  -webkit-mask-image: radial-gradient(ellipse 86% 84% at 50% 48%, #000 84%, transparent 100%);
  mask-image: radial-gradient(ellipse 86% 84% at 50% 48%, #000 84%, transparent 100%);
}
.imagery-label {
  font-size: 0.8em; color: var(--gold);
  letter-spacing: 0.04em; margin-bottom: 12px;
}
.imagery-form {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  font-size: 1.42em; font-weight: 700; color: var(--navy);
  line-height: 1.5; margin-bottom: 12px;
}
.imagery-reading { color: var(--ink-soft); font-size: 0.96em; line-height: 1.8; }

/* ── 목차 (번호 칩 + 2단 그리드) ─────────────────── */
.toc {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 14px; padding: 20px 24px; margin: 8px 0 12px;
  box-shadow: 0 1px 6px rgba(31,59,99,0.05);
}
.toc-title {
  font-family: 'Nanum Myeongjo', 'Noto Serif KR', Batang, serif;
  color: var(--navy); font-size: 1.05em; letter-spacing: 0.06em;
  margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line);
}
.toc-list { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 30px; }
.toc-list li { break-inside: avoid; margin: 0; }
.toc-list a {
  display: flex; align-items: baseline; gap: 10px;
  padding: 7px 2px; color: var(--ink); text-decoration: none;
  border-bottom: 1px solid #f2eee4; font-size: 0.9em; line-height: 1.4;
}
.toc-num {
  color: var(--gold); font-weight: 700; font-size: 0.82em;
  font-variant-numeric: tabular-nums; min-width: 20px;
}
.toc-label { flex: 1; }
.toc-list a:hover .toc-label { color: var(--navy); }

/* ── 오행·사전 항목 색 칩 헤드 ─────────────────── */
.wx-item {
  display: flex; align-items: center; gap: 9px;
  margin: 1.7em 0 0.5em; font-size: 1.06em; font-weight: 700; color: var(--navy);
}
.wx-dot { width: 13px; height: 13px; border-radius: 50%; flex: none; }
.wx-item.wx-pillar .wx-dot { border-radius: 3px; }

/* ── 이름 오행 칩 ────────────────────────────────── */
.name-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 18px; }
.name-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--card); border: 1.5px solid var(--line);
  border-radius: 12px; padding: 7px 13px; font-size: 0.88em;
}
.name-chip b { color: var(--navy); font-size: 1.25em; font-weight: 700; }
.name-chip-x { color: var(--ink-soft); }

/* ── 한 장 요약 스펙 그리드 ─────────────────────── */
.spec-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0;
}
.spec-item {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 10px; padding: 11px 14px;
}
.spec-label { font-size: 0.76em; color: var(--gold); font-weight: 700; margin-bottom: 3px; }
.spec-value { font-weight: 700; color: var(--navy); font-size: 0.94em; line-height: 1.4; }

/* ── 매핑 표: '이 아이' 강한 행 하이라이트 ───────── */
.report table.maptable tr.hl td {
  background: #f8efd4; font-weight: 500;
}
.report table.maptable tr.hl td:first-child { box-shadow: inset 3px 0 0 var(--gold); }

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
  .imagery-form { font-size: 1.24em; }
  .toc-list { columns: 1; }
  /* 표는 셀 줄바꿈을 허용해 화면 폭에 맞춘다 (가로 스크롤 대신 세로로 늘어남).
     넘칠 때만 스크롤(폴백). 이전엔 nowrap이라 대부분의 표가 옆으로 잘렸다. */
  .report table { font-size: 0.86em; }
  .report th, .report td { padding: 7px 9px; white-space: normal; word-break: keep-all; }
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
  .toc, .imagery-card, .chapter-divider { break-inside: avoid; box-shadow: none; }
  .chapter-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
