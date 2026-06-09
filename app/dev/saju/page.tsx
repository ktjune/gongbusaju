"use client";

/**
 * 개발·검증 전용 페이지 — /dev/saju
 *
 * 목적: computeSaju 결과를 사람이 직접 눈으로 검증.
 * 상품 UI 아님 — 결제·디자인·인증 없음.
 */

import { useState } from "react";
import { computeSaju, solarFromLunar } from "@/lib/saju";
import type { SajuResult } from "@/lib/saju";

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

const ELEMENTS: Array<{ key: keyof SajuResult["elements"]; label: string; color: string }> = [
  { key: "목", label: "木 목", color: "#4ade80" },
  { key: "화", label: "火 화", color: "#f87171" },
  { key: "토", label: "土 토", color: "#facc15" },
  { key: "금", label: "金 금", color: "#94a3b8" },
  { key: "수", label: "水 수", color: "#60a5fa" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

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
        // 음력 → 양력 변환
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
        useTrueSolarTime: false,
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
      <p style={styles.notice}>동경 135° 표준시(KST) 기준 · 진태양시 보정 미적용</p>

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
              <td style={{ ...styles.td, ...styles.ganji }}>
                {noTime || result.pillars.hour === null ? (
                  <span style={styles.noTime}>—</span>
                ) : (
                  result.pillars.hour
                )}
              </td>
              <td style={{ ...styles.td, ...styles.ganji }}>{result.pillars.day}</td>
              <td style={{ ...styles.td, ...styles.ganji }}>{result.pillars.month}</td>
              <td style={{ ...styles.td, ...styles.ganji }}>{result.pillars.year}</td>
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
          {ELEMENTS.map(({ key, label, color }) => {
            const pct = result.elements[key];
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 48, fontWeight: "bold" }}>{label}</span>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${pct}%`,
                      background: color,
                    }}
                  />
                </div>
                <span style={styles.pct}>{pct}%</span>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {result.daeun.map((step, i) => (
            <div key={i} style={styles.daeunCard}>
              <div style={styles.daeunAge}>{step.age}세~</div>
              <div style={styles.daeunGanji}>{step.ganji}</div>
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
        ※ 동경 135° 표준시(KST) 기준 · 진태양시 보정 미적용<br />
        ※ 이 결과는 lunar-javascript 기반 자체 계산입니다.
        권위 있는 만세력과 반드시 대조 검증하세요.
      </p>
    </div>
  );
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
            {name} {count}
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
    maxWidth: 700,
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
  h2: { fontSize: 15, margin: "0 0 12px", color: "#1e3a8a" },
  table: { borderCollapse: "collapse", width: "100%" },
  th: {
    border: "1px solid #d1d5db",
    padding: "6px 12px",
    background: "#f3f4f6",
    textAlign: "center",
    fontSize: 13,
  },
  td: { border: "1px solid #d1d5db", padding: "8px 12px", textAlign: "center" },
  ganji: { fontSize: 22, letterSpacing: 2, fontWeight: "bold" },
  noTime: { color: "#9ca3af", fontSize: 18 },
  hint: { margin: "6px 0 0", color: "#6b7280", fontSize: 12 },
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
    padding: "6px 12px",
    textAlign: "center",
    background: "#f9fafb",
    minWidth: 72,
  },
  daeunAge: { fontSize: 11, color: "#6b7280" },
  daeunGanji: { fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
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
    padding: "2px 10px",
    fontSize: 13,
  },
  footer: {
    fontSize: 11,
    color: "#6b7280",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 12,
    marginTop: 4,
    lineHeight: 1.8,
  },
};
