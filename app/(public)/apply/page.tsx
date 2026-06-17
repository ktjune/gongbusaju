"use client";

/**
 * /apply — 신청 폼 (Phase 5b)
 *
 * 생년월일시·성별·(Premium)주소/재학학교·연락처·동의 입력 → POST /api/order.
 * 결제는 모의(자격증명 전). 제출 성공 시 "제작 중" 안내 화면.
 *
 * PII는 서버(/api/order)에서 즉시 암호화 저장 — 이 폼은 평문을 전송만 하고 보관하지 않는다.
 */

import { useState } from "react";
import styles from "./apply.module.css";

type Tier = "basic" | "premium";

const FIRST_YEAR = 1980;
const YEARS = Array.from(
  { length: new Date().getFullYear() - FIRST_YEAR + 1 },
  (_, i) => new Date().getFullYear() - i
);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ApplyPage() {
  const [tier, setTier] = useState<Tier>("premium");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthHour, setBirthHour] = useState("");
  const [birthMinute, setBirthMinute] = useState("0");
  const [address, setAddress] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderId: string; token: string | null } | null>(null);

  const canSubmit =
    birthYear &&
    birthMonth &&
    birthDay &&
    (timeUnknown || birthHour !== "") &&
    consent &&
    (tier === "basic" || address.trim()) &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          birthYear: Number(birthYear),
          birthMonth: Number(birthMonth),
          birthDay: Number(birthDay),
          birthHour: timeUnknown ? null : Number(birthHour),
          birthMinute: timeUnknown ? null : Number(birthMinute),
          gender,
          address: tier === "premium" ? address : undefined,
          currentSchool: tier === "premium" ? currentSchool : undefined,
          contactEmail,
          contactPhone,
          consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "신청에 실패했습니다.");
        return;
      }
      // 데모: 주문 직후 생성 트리거 (실서비스는 결제 웹훅/큐가 담당)
      let token: string | null = null;
      try {
        const gen = await fetch("/api/generate-trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        if (gen.ok) token = (await gen.json()).token ?? null;
      } catch {
        /* 생성 실패해도 접수는 완료 — 검수/재시도로 처리 */
      }
      setDone({ orderId: data.orderId, token });
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.sheet}>
          <div className={styles.done}>
            <div className={styles.doneIcon}>✓</div>
            <h1 className={styles.title}>신청이 접수되었습니다</h1>
            <p className={styles.subtitle}>
              리포트는 사주 계산과 검수를 거쳐 제작됩니다.
              <br />
              완성되면 입력하신 연락처로 결과 링크를 보내 드립니다.
            </p>
            <p className={styles.hint}>접수번호: {done.orderId}</p>
            {done.token && (
              <p style={{ marginTop: 20 }}>
                <a className={styles.submit} style={{ display: "inline-block", textDecoration: "none", width: "auto", padding: "12px 24px" }} href={`/result/${done.token}?preview=1`}>
                  리포트 미리보기 (데모)
                </a>
              </p>
            )}
          </div>
          <p className={styles.notice}>
            * 결제 연동 전 데모입니다. 실제로는 전문가 검수 후 결과 링크를 보내 드립니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <div className={styles.badge}>공부·기질 사주 리포트</div>
        <h1 className={styles.title}>우리 아이 리포트 신청</h1>
        <p className={styles.subtitle}>
          아이의 생년월일시로 타고난 공부 기질을 풀이해 드립니다.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        {/* 요금제 */}
        <div className={styles.tiers}>
          <button
            type="button"
            className={`${styles.tier} ${tier === "basic" ? styles.tierActive : ""}`}
            onClick={() => setTier("basic")}
          >
            <div className={styles.tierName}>Basic</div>
            <div className={styles.tierDesc}>공부·기질 사주 해석</div>
            <div className={styles.tierPrice}>29,000원</div>
          </button>
          <button
            type="button"
            className={`${styles.tier} ${tier === "premium" ? styles.tierActive : ""}`}
            onClick={() => setTier("premium")}
          >
            <div className={styles.tierName}>Premium</div>
            <div className={styles.tierDesc}>+ 지역 학교군 정보</div>
            <div className={styles.tierPrice}>49,000원</div>
          </button>
        </div>

        {/* 아이 정보 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>아이 정보</h2>

          <div className={styles.field}>
            <label className={styles.label}>생년월일 (양력)</label>
            <div className={styles.row}>
              <select className={styles.select} value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
                <option value="">년</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={styles.select} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                <option value="">월</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className={styles.select} value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
                <option value="">일</option>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>출생 시각</label>
            <div className={styles.row}>
              <select className={styles.select} value={birthHour} disabled={timeUnknown} onChange={(e) => setBirthHour(e.target.value)}>
                <option value="">시</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
              </select>
              <select className={styles.select} value={birthMinute} disabled={timeUnknown} onChange={(e) => setBirthMinute(e.target.value)}>
                {Array.from({ length: 60 }, (_, i) => i).map((m) => <option key={m} value={m}>{m}분</option>)}
              </select>
            </div>
            <label className={styles.checkRow} style={{ marginTop: 8 }}>
              <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
              <span>출생 시각을 모릅니다 (시주를 제외하고 풀이합니다)</span>
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>성별</label>
            <div className={styles.row}>
              <select className={styles.select} value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
                <option value="male">남자</option>
                <option value="female">여자</option>
              </select>
            </div>
          </div>
        </div>

        {/* Premium 추가 정보 */}
        {tier === "premium" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>거주지 · 학교 (Premium)</h2>
            <div className={styles.field}>
              <label className={styles.label}>주소</label>
              <input
                className={styles.input}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울특별시 종로구 자하문로 105"
              />
              <p className={styles.hint}>예상 배정 학교·반경 학교군 안내에 사용됩니다.</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>현재 재학 기관 (선택)</label>
              <input
                className={styles.input}
                value={currentSchool}
                onChange={(e) => setCurrentSchool(e.target.value)}
                placeholder="예: 청운초등학교 / 푸른숲유치원"
              />
            </div>
          </div>
        )}

        {/* 연락처 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>연락처 (결과 안내)</h2>
          <div className={styles.field}>
            <label className={styles.label}>이메일</label>
            <input className={styles.input} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="parent@example.com" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>휴대폰 (선택)</label>
            <input className={styles.input} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="010-0000-0000" />
          </div>
        </div>

        {/* 동의 */}
        <div className={styles.section}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              (필수) 만 14세 미만 자녀의 개인정보(생년월일시·주소·학교) 수집·이용에
              <b> 법정대리인으로서 동의</b>합니다. 정보는 암호화 저장되며 리포트 제작·보관기간(12개월) 후 파기됩니다.
            </span>
          </label>
        </div>

        <button className={styles.submit} type="submit" disabled={!canSubmit}>
          {submitting ? "접수 중…" : `신청하기 (${tier === "premium" ? "49,000" : "29,000"}원)`}
        </button>

        <p className={styles.notice}>
          * 결제 연동 전 데모입니다. 지금은 결제 없이 신청이 접수됩니다.
          <br />
          본 리포트의 해석은 사주 명리의 관점이며, 실측 검사 결과가 아닙니다.
        </p>
      </form>
    </div>
  );
}
