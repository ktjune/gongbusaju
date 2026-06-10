"use client";

/**
 * 개발·검증 전용 페이지 — /dev/saju
 *
 * 목적: computeSaju 결과를 사람이 직접 눈으로 검증.
 * 상품 UI 아님 — 결제·디자인·인증 없음.
 */

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  computeSaju,
  solarFromLunar,
  withHangul,
  tenGodWithHangul,
  formatDaeunAge,
} from "@/lib/saju";
import type { SajuResult } from "@/lib/saju";

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

const ELEMENTS: Array<{ key: keyof SajuResult["elements"]; hanja: string; hangul: string; color: string }> = [
  { key: "목", hanja: "木", hangul: "목", color: "#4ade80" },
  { key: "화", hanja: "火", hangul: "화", color: "#f87171" },
  { key: "토", hanja: "土", hangul: "토", color: "#facc15" },
  { key: "금", hanja: "金", hangul: "금", color: "#94a3b8" },
  { key: "수", hanja: "水", hangul: "수", color: "#60a5fa" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

type FormState = {
  calType: "solar" | "lunar";
  isLeapMonth: boolean;
  year: string;
  month: string;
  day: string;
  noTime: boolean;
  hour: string;
  minute: string;
  gender: "male" | "female";
};

// ──────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────────────────────

export default function DevSajuPage() {
  // 개발·검증 전용 — 프로덕션 빌드에서는 기본 404.
  // 배포 환경에서 검증 페이지가 필요하면 빌드 시
  // NEXT_PUBLIC_ENABLE_DEV_TOOLS=1 로 열 수 있다 (상용 오픈 전 반드시 제거).
  const devToolsEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "1";
  if (!devToolsEnabled) notFound();

  const [form, setForm] = useState<FormState>({
    calType: "solar",
    isLeapMonth: false,
    year: "1990",
    month: "1",
    day: "1",
    noTime: false,
    hour: "12",
    minute: "0",
    gender: "male",
  });

  const [result, setResult] = useState<SajuResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solvedSolar, setSolvedSolar] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSolvedSolar(null);

    try {
      const y = parseInt(form.year, 10);
      const m = parseInt(form.month, 10);
      const d = parseInt(form.day, 10);

      let solarY = y, solarM = m, solarD = d;

      if (form.calType === "lunar") {
        const solar = solarFromLunar(y, m, d);
        solarY = solar.year;
        solarM = solar.month;
        solarD = solar.day;
        setSolvedSolar(`→ 양력 ${solarY}년 ${solarM}월 ${solarD}일`);
      }

      const hour = form.noTime ? undefined : parseInt(form.hour, 10);
      const minute = form.noTime ? 0 : parseInt(form.minute, 10);

      const sajuResult = computeSaju({
        birthYear: solarY,
        birthMonth: solarM,
        birthDay: solarD,
        birthHour: hour,
        birthMinute: minute,
        gender: form.gender,
      });

      setResult(sajuResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={styles.page}>
      {/* 헤더 */}
      <div style={styles.devBanner}>
        🔧 개발·검증 전용 페이지 — 상품 UI 아님
      </div>

      <h1 style={styles.h1}>만세력 결과 검증</h1>
      <p style={styles.notice}>
        일·시주: 동경 127.5° 보정(-30분, 일주 변경 00:30 야자시) · 연·월주: KASI 절입시각(KST) 기준 · 십성: 본기 위주
      </p>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* 양력/음력 */}
        <Row label="달력">
          <label style={styles.radio}>
            <input
              type="radio"
              checked={form.calType === "solar"}
              onChange={() => set("calType", "solar")}
            />
            {" "}양력
          </label>
          <label style={styles.radio}>
            <input
              type="radio"
              checked={form.calType === "lunar"}
              onChange={() => set("calType", "lunar")}
            />
            {" "}음력
          </label>
          {form.calType === "lunar" && (
            <label style={{ ...styles.radio, marginLeft: 12 }}>
              <input
                type="checkbox"
                checked={form.isLeapMonth}
                onChange={(e) => set("isLeapMonth", e.target.checked)}
              />
              {" "}윤달
            </label>
          )}
        </Row>

        {/* 생년월일 */}
        <Row label="생년월일">
          <input
            type="number"
            value={form.year}
            min={1900}
            max={2100}
            onChange={(e) => set("year", e.target.value)}
            style={{ ...styles.input, width: 80 }}
          />
          년{" "}
          <select
            value={form.month}
            onChange={(e) => set("month", e.target.value)}
            style={styles.select}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          월{" "}
          <select
            value={form.day}
            onChange={(e) => set("day", e.target.value)}
            style={styles.select}
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          일
          {solvedSolar && <span style={styles.converted}>{solvedSolar}</span>}
        </Row>

        {/* 출생 시각 */}
        <Row label="출생 시각">
          <label style={styles.radio}>
            <input
              type="checkbox"
              checked={form.noTime}
              onChange={(e) => set("noTime", e.target.checked)}
            />
            {" "}시간 모름 (時柱 제외)
          </label>
          {!form.noTime && (
            <>
              {" "}
              <select
                value={form.hour}
                onChange={(e) => set("hour", e.target.value)}
                style={styles.select}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
              시{" "}
              <select
                value={form.minute}
                onChange={(e) => set("minute", e.target.value)}
                style={styles.select}
              >
                {MINUTES.map((min) => (
                  <option key={min} value={min}>{String(min).padStart(2, "0")}</option>
                ))}
              </select>
              분
            </>
          )}
        </Row>

        {/* 성별 */}
        <Row label="성별">
          <label style={styles.radio}>
            <input
              type="radio"
              checked={form.gender === "male"}
              onChange={() => set("gender", "male")}
            />
            {" "}남
          </label>
          <label style={styles.radio}>
            <input
              type="radio"
              checked={form.gender === "female"}
              onChange={() => set("gender", "female")}
            />
            {" "}여
          </label>
        </Row>

        <button type="submit" style={styles.btn}>계산</button>
      </form>

      {/* 에러 */}
      {error && <p style={styles.error}>⚠ {error}</p>}

      {/* 결과 */}
      {result && <SajuResultView result={result} noTime={form.noTime} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 결과 표시 컴포넌트
// ──────────────────────────────────────────────────────────────

function SajuResultView({ result, noTime }: { result: SajuResult; noTime: boolean }) {
  return (
    <div style={styles.result}>
      {/* 4기둥 */}
      <Section title="사주팔자 (四柱八字)">
        <table style={styles.table}>
          <thead>
            <tr>
              {["時柱", "日柱", "月柱", "年柱"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {/* 時柱 */}
              <td style={{ ...styles.td, ...styles.ganjiCell }}>
                {noTime || result.pillars.hour === null ? (
                  <span style={styles.noTime}>—</span>
                ) : (
                  <GanjiCell ganji={result.pillars.hour} />
                )}
              </td>
              {/* 日柱 */}
              <td style={{ ...styles.td, ...styles.ganjiCell }}>
                <GanjiCell ganji={result.pillars.day} />
              </td>
              {/* 月柱 */}
              <td style={{ ...styles.td, ...styles.ganjiCell }}>
                <GanjiCell ganji={result.pillars.month} />
              </td>
              {/* 年柱 */}
              <td style={{ ...styles.td, ...styles.ganjiCell }}>
                <GanjiCell ganji={result.pillars.year} />
              </td>
            </tr>
          </tbody>
        </table>
        {(noTime || result.pillars.hour === null) && (
          <p style={styles.hint}>時柱 제외 — 출생 시각 모름</p>
        )}
      </Section>

      {/* 오행 */}
      <Section title="오행 분포 (五行)">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ELEMENTS.map(({ key, hanja, hangul, color }) => {
            const pct = result.elements[key];
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 60, fontWeight: "bold" }}>
                  {hanja}({hangul})
                </span>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${pct}%`,
                      background: color,
                    }}
                  />
                </div>
                <span style={styles.pct}>{Math.round(pct)}%</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 십성 */}
      <Section title="십성 분포 (十神)">
        <TenGodsView tenGods={result.tenGods} />
      </Section>

      {/* 대운 */}
      <Section title="대운 (大運)">
        <p style={styles.ageNote}>
          나이 기준: <strong>만나이</strong>
          <span style={styles.ageNoteDetail}>
            {" "}(Yun.getStartYear()/getStartMonth() — 출생 후 경과 시간 = 만나이.
            전통 만세력은 세는나이로 표기하므로 권위 만세력과 ±1~2세 차이 날 수 있음)
          </span>
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {result.daeun.map((step, i) => (
            <div key={i} style={styles.daeunCard}>
              <div style={styles.daeunAge}>{formatDaeunAge(step.age, step.startMonths)}</div>
              <div style={styles.daeunGanji}>{withHangul(step.ganji)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 기질 점수 */}
      <Section title="기질 점수 (해석 지표, 측정치 아님)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(result.traitScores).map(([key, val]) => (
            <div key={key} style={styles.traitCard}>
              <div style={styles.traitLabel}>{key}</div>
              <div style={styles.traitScore}>{val}</div>
            </div>
          ))}
        </div>
      </Section>

      <p style={styles.footer}>
        ※ 일주·시주: 동경 127.5° 경도 보정(-30분) 적용. 일주는 KST 00:30에 변경(야자시 방식). 한국 주류 만세력 관행.<br />
        ※ 연주·월주·대운(절기 비교): 보정 없이 KASI 절입시각(KST)과 직접 비교.<br />
        ※ 십성: 지지 본기(本氣) 위주 집계 — 일간 제외 최대 7개 (점신식).<br />
        ※ 대운 나이: Yun.getStartYear()/getStartMonth() 기반 만나이 (출생 후 경과 시간).
        전통 만세력은 세는나이 표기 — 교차 검증 시 ±1~2세 차이 발생할 수 있음.<br />
        ※ 이 결과는 lunar-javascript 기반 자체 계산입니다.
        권위 있는 만세력과 반드시 대조 검증하세요.
      </p>
    </div>
  );
}

/** 간지(干支) 셀 — "甲子\n갑자" 2행 표시 */
function GanjiCell({ ganji }: { ganji: string }) {
  const [gan, zhi] = [ganji[0], ganji[1]];
  const display = withHangul(ganji);
  // "甲子(갑자)" 형식에서 괄호 앞/안을 분리해 줄바꿈으로 표시
  const match = display.match(/^(.+)\((.+)\)$/);
  if (match) {
    return (
      <div>
        <div style={{ fontSize: 22, letterSpacing: 2, fontWeight: "bold" }}>
          {gan}{zhi}
        </div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
          {match[2]}
        </div>
      </div>
    );
  }
  return <span style={{ fontSize: 22 }}>{ganji}</span>;
}

function TenGodsView({ tenGods }: { tenGods: Record<string, number> }) {
  const entries = Object.entries(tenGods).filter(([, v]) => v > 0);
  if (entries.length === 0) return <p style={styles.hint}>십성 데이터 없음</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {entries
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => (
          <span key={name} style={styles.badge}>
            {tenGodWithHangul(name)} ×{count}
          </span>
        ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {children}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 스타일 (인라인 — 검증용 최소)
// ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "monospace, sans-serif",
    fontSize: 14,
    color: "#1e1e1e",
  },
  devBanner: {
    background: "#fef08a",
    border: "1px solid #ca8a04",
    borderRadius: 4,
    padding: "6px 12px",
    marginBottom: 16,
    fontSize: 13,
  },
  h1: { fontSize: 20, margin: "0 0 4px" },
  notice: { color: "#555", fontSize: 12, margin: "0 0 20px" },
  form: {
    background: "#f8f8f8",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row: { display: "flex", alignItems: "center", gap: 12 },
  rowLabel: { width: 80, fontWeight: "bold", flexShrink: 0 },
  radio: { display: "flex", alignItems: "center", gap: 2 },
  input: {
    padding: "3px 6px",
    border: "1px solid #ccc",
    borderRadius: 3,
    fontFamily: "inherit",
    fontSize: 14,
  },
  select: {
    padding: "3px 4px",
    border: "1px solid #ccc",
    borderRadius: 3,
    fontFamily: "inherit",
    fontSize: 14,
  },
  converted: { color: "#2563eb", marginLeft: 8 },
  btn: {
    alignSelf: "flex-start",
    padding: "6px 20px",
    background: "#1e40af",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
  },
  error: { color: "#dc2626", margin: "8px 0" },
  result: {
    marginTop: 24,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  section: {
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
  },
  h2: { fontSize: 15, margin: "0 0 10px", color: "#1e3a8a" },
  table: { borderCollapse: "collapse", width: "100%" },
  th: {
    border: "1px solid #d1d5db",
    padding: "6px 12px",
    background: "#f3f4f6",
    textAlign: "center",
    fontSize: 13,
  },
  td: { border: "1px solid #d1d5db", padding: "10px 12px", textAlign: "center" },
  ganjiCell: { verticalAlign: "middle" },
  noTime: { color: "#9ca3af", fontSize: 18 },
  hint: { margin: "6px 0 0", color: "#6b7280", fontSize: 12 },
  ageNote: {
    margin: "0 0 10px",
    fontSize: 12,
    color: "#374151",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 4,
    padding: "4px 8px",
  },
  ageNoteDetail: { color: "#6b7280" },
  barBg: {
    width: 200,
    height: 16,
    background: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  pct: { width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  daeunCard: {
    border: "1px solid #d1d5db",
    borderRadius: 4,
    padding: "8px 12px",
    textAlign: "center",
    background: "#f9fafb",
    minWidth: 90,
  },
  daeunAge: { fontSize: 11, color: "#2563eb", fontWeight: "bold", marginBottom: 2 },
  daeunGanji: { fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  traitCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "6px 12px",
    textAlign: "center",
    background: "#f0f9ff",
    minWidth: 72,
  },
  traitLabel: { fontSize: 11, color: "#374151" },
  traitScore: { fontSize: 20, fontWeight: "bold", color: "#1e40af" },
  badge: {
    background: "#e0e7ff",
    color: "#3730a3",
    borderRadius: 12,
    padding: "3px 10px",
    fontSize: 13,
  },
  footer: {
    fontSize: 11,
    color: "#6b7280",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 12,
    marginTop: 4,
    lineHeight: 1.9,
  },
};
