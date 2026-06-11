/**
 * lib/report/charts.ts
 * SVG 도식 생성기 — SajuResult에서 결정론적으로 생성. LLM 미관여.
 *
 * 반환값은 인라인 <svg> 문자열로, 웹 결과페이지·PDF·마크다운(HTML 허용 렌더러)에
 * 그대로 삽입할 수 있다. 외부 라이브러리·폰트 의존 없음 (시스템 폰트 + 순수 도형).
 */

import type { SajuResult } from "../saju";

/** 오행 표준 색상 (한국 만세력 관행: 木청·火적·土황·金백·水흑) */
export const WUXING_COLOR: Record<string, string> = {
  木: "#3d9a50",
  火: "#d64545",
  土: "#c9a227",
  金: "#8e9aa8",
  水: "#3b6fb5",
};

const FONT = `font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif"`;

// ──────────────────────────────────────────────────────────────
// 1. 오행 분포 가로 막대 차트
// ──────────────────────────────────────────────────────────────

export function elementsBarChart(saju: SajuResult): string {
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];
  const W = 560, ROW = 44, PAD_L = 90, PAD_R = 60, BAR_MAX = W - PAD_L - PAD_R;
  const H = ROW * order.length + 20;

  const rows = order.map(([hanja, key], i) => {
    const pct = saju.elements[key];
    const y = 10 + i * ROW;
    const w = Math.max(2, (pct / 100) * BAR_MAX);
    const color = WUXING_COLOR[hanja];
    return [
      `<text x="${PAD_L - 12}" y="${y + 21}" text-anchor="end" font-size="15" font-weight="bold" fill="${color}" ${FONT}>${hanja}(${key})</text>`,
      `<rect x="${PAD_L}" y="${y}" width="${BAR_MAX}" height="30" rx="6" fill="#f0f0f0"/>`,
      `<rect x="${PAD_L}" y="${y}" width="${w}" height="30" rx="6" fill="${color}"/>`,
      `<text x="${PAD_L + BAR_MAX + 10}" y="${y + 21}" font-size="14" fill="#333" ${FONT}>${Math.round(pct)}%</text>`,
    ].join("");
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="오행 분포 막대 차트">${rows.join("")}</svg>`;
}

// ──────────────────────────────────────────────────────────────
// 2. 오행 상생·상극 순환도 — 강한 기운은 크게, 없는 기운은 옅게
// ──────────────────────────────────────────────────────────────

export function wuxingCycleChart(saju: SajuResult): string {
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];
  const W = 480, H = 420, CX = W / 2, CY = H / 2 + 6, R = 150;

  // 五行을 정오각형 꼭짓점에 배치 (木이 위, 시계방향 = 상생 순서)
  const pos = order.map(([hanja, key], i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { hanja, key, x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) };
  });

  const pt = (i: number) => pos[i % 5];

  /** 두 점 사이 선분을 노드 반지름만큼 안쪽으로 줄인 좌표 */
  const trim = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number) => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    return {
      x1: x1 + (dx / len) * r1, y1: y1 + (dy / len) * r1,
      x2: x2 - (dx / len) * r2, y2: y2 - (dy / len) * r2,
    };
  };

  const nodeR = (pct: number) => 22 + (pct / 100) * 26; // 22~48px

  // 상생(이웃, 실선 회색) / 상극(별모양 +2, 점선 연한 적색)
  const arrows: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = pt(i), b = pt(i + 1);
    const ra = nodeR(saju.elements[a.key]), rb = nodeR(saju.elements[b.key]);
    const t = trim(a.x, a.y, b.x, b.y, ra + 2, rb + 8);
    arrows.push(
      `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="#7a9e7e" stroke-width="2.5" marker-end="url(#sheng)"/>`
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = pt(i), b = pt(i + 2);
    const ra = nodeR(saju.elements[a.key]), rb = nodeR(saju.elements[b.key]);
    const t = trim(a.x, a.y, b.x, b.y, ra + 2, rb + 8);
    arrows.push(
      `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="#d6a0a0" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#ke)"/>`
    );
  }

  const nodes = pos.map(({ hanja, key, x, y }) => {
    const pct = saju.elements[key];
    const r = nodeR(pct);
    const color = WUXING_COLOR[hanja];
    const opacity = pct === 0 ? 0.28 : 1;
    return [
      `<g opacity="${opacity}">`,
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`,
      `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="${r * 0.7}" font-weight="bold" fill="#fff" ${FONT}>${hanja}</text>`,
      `<text x="${x}" y="${y + r + 16}" text-anchor="middle" font-size="13" fill="#444" ${FONT}>${key} ${Math.round(pct)}%</text>`,
      `</g>`,
    ].join("");
  });

  const legend = [
    `<g transform="translate(14,14)">`,
    `<line x1="0" y1="6" x2="30" y2="6" stroke="#7a9e7e" stroke-width="2.5"/>`,
    `<text x="36" y="10" font-size="12" fill="#444" ${FONT}>상생(낳아 줌)</text>`,
    `<line x1="130" y1="6" x2="160" y2="6" stroke="#d6a0a0" stroke-width="1.6" stroke-dasharray="5 4"/>`,
    `<text x="166" y="10" font-size="12" fill="#444" ${FONT}>상극(눌러 줌)</text>`,
    `</g>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="오행 상생 상극 순환도">`,
    `<defs>`,
    `<marker id="sheng" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#7a9e7e"/></marker>`,
    `<marker id="ke" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#d6a0a0"/></marker>`,
    `</defs>`,
    legend,
    ...arrows,
    ...nodes,
    `</svg>`,
  ].join("");
}

// ──────────────────────────────────────────────────────────────
// 3. 기질 지표 레이더 차트 (6축)
// ──────────────────────────────────────────────────────────────

export function traitsRadarChart(saju: SajuResult): string {
  const entries = Object.entries(saju.traitScores);
  const n = entries.length;
  if (n < 3) return "";

  const W = 460, H = 420, CX = W / 2, CY = H / 2 + 8, R = 140;

  const point = (i: number, ratio: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: CX + R * ratio * Math.cos(ang), y: CY + R * ratio * Math.sin(ang) };
  };

  // 배경 그리드 (25/50/75/100%)
  const grids = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const pts = entries.map((_, i) => { const p = point(i, ratio); return `${p.x},${p.y}`; }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="#ddd" stroke-width="1"/>`;
  });

  // 축선 + 라벨
  const axes = entries.map(([label], i) => {
    const tip = point(i, 1);
    const lab = point(i, 1.18);
    return [
      `<line x1="${CX}" y1="${CY}" x2="${tip.x}" y2="${tip.y}" stroke="#ddd" stroke-width="1"/>`,
      `<text x="${lab.x}" y="${lab.y + 4}" text-anchor="middle" font-size="14" fill="#333" ${FONT}>${label}</text>`,
    ].join("");
  });

  // 점수 폴리곤
  const scorePts = entries.map(([, v], i) => {
    const p = point(i, Math.max(0, Math.min(100, v)) / 100);
    return `${p.x},${p.y}`;
  }).join(" ");

  const dots = entries.map(([, v], i) => {
    const p = point(i, Math.max(0, Math.min(100, v)) / 100);
    return `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#3b6fb5"/>`;
  });

  const values = entries.map(([, v], i) => {
    const p = point(i, Math.max(0, Math.min(100, v)) / 100 + 0.1);
    return `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" fill="#3b6fb5" font-weight="bold" ${FONT}>${v}</text>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="기질 지표 레이더 차트">`,
    ...grids,
    ...axes,
    `<polygon points="${scorePts}" fill="rgba(59,111,181,0.25)" stroke="#3b6fb5" stroke-width="2"/>`,
    ...dots,
    ...values,
    `</svg>`,
  ].join("");
}

// ──────────────────────────────────────────────────────────────
// 4. 대운 타임라인 — 학령기 구간 강조
// ──────────────────────────────────────────────────────────────

export function daeunTimelineChart(saju: SajuResult): string {
  const shown = saju.daeun.slice(0, 5);
  if (shown.length === 0) return "";

  const W = 620, H = 170, PAD = 30;
  const minAge = 0;
  const maxAge = shown[shown.length - 1].age + 10;
  const X = (age: number) => PAD + ((age - minAge) / (maxAge - minAge)) * (W - PAD * 2);
  const BAND_Y = 70, BAND_H = 40;

  // 학령기 배경 밴드 (초등 6-12, 중등 12-15, 고등 15-18)
  const stages: Array<[number, number, string, string]> = [
    [6, 12, "초등", "#eaf3ea"],
    [12, 15, "중등", "#fdf3e2"],
    [15, 18, "고등", "#fbe9e7"],
  ];
  const stageBands = stages
    .filter(([s]) => s < maxAge)
    .map(([s, e, label, color]) => {
      const x1 = X(Math.max(s, minAge)), x2 = X(Math.min(e, maxAge));
      return [
        `<rect x="${x1}" y="${BAND_Y - 34}" width="${x2 - x1}" height="${BAND_H + 56}" fill="${color}"/>`,
        `<text x="${(x1 + x2) / 2}" y="${BAND_Y - 40}" text-anchor="middle" font-size="12" fill="#666" ${FONT}>${label}</text>`,
      ].join("");
    });

  // 대운 구간 박스
  const blocks = shown.map((d, i) => {
    const x1 = X(d.age), x2 = X(Math.min(d.age + 10, maxAge));
    const fill = i % 2 === 0 ? "#3b6fb5" : "#5c87c5";
    return [
      `<rect x="${x1}" y="${BAND_Y}" width="${x2 - x1 - 2}" height="${BAND_H}" rx="6" fill="${fill}"/>`,
      `<text x="${(x1 + x2) / 2}" y="${BAND_Y + 25}" text-anchor="middle" font-size="15" font-weight="bold" fill="#fff" ${FONT}>${d.ganji}</text>`,
      `<text x="${x1}" y="${BAND_Y + BAND_H + 20}" font-size="11.5" fill="#444" ${FONT}>만 ${d.age}세${d.startMonths ? ` ${d.startMonths}개월` : ""}</text>`,
    ].join("");
  });

  // 출생 ~ 첫 대운 전 (원국 구간)
  const firstX = X(shown[0].age);
  const preBlock = [
    `<rect x="${X(0)}" y="${BAND_Y}" width="${firstX - X(0) - 2}" height="${BAND_H}" rx="6" fill="#c8cdd4"/>`,
    `<text x="${(X(0) + firstX) / 2}" y="${BAND_Y + 25}" text-anchor="middle" font-size="12" fill="#fff" ${FONT}>원국</text>`,
    `<text x="${X(0)}" y="${BAND_Y + BAND_H + 20}" font-size="11.5" fill="#444" ${FONT}>출생</text>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="대운 타임라인">`,
    ...stageBands,
    preBlock,
    ...blocks,
    `</svg>`,
  ].join("");
}
