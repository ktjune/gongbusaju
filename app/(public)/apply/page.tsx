"use client";

/**
 * /apply — 신청 폼
 *
 * 생년월일시·성별·(선택)주소/재학학교·연락처·동의 입력 → POST /api/order.
 * 결제는 모의(자격증명 전). 제출 성공 시 "제작 중" 안내 화면.
 *
 * - 생년월일/시각: 네이티브 피커(달력·시계). 직접 타이핑도 가능.
 * - 주소: 카카오(다음) 우편번호 검색 위젯으로 도로명주소 선택(선택 입력).
 *   사주 계산은 출생지를 쓰지 않으므로(동경 127.5° 고정 보정) 주소는 학교 안내용일 뿐이다.
 *
 * PII는 서버(/api/order)에서 즉시 암호화 저장 — 이 폼은 평문을 전송만 하고 보관하지 않는다.
 */

import { useRef, useState } from "react";
import styles from "./apply.module.css";

const PRICE = "29,000";
const MIN_DATE = "1980-01-01";
const MAX_DATE = new Date().toISOString().slice(0, 10);
const DAUM_POSTCODE_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void;
        onclose?: (state: string) => void;
        width?: string | number;
        height?: string | number;
      }) => { open: () => void; embed: (el: HTMLElement) => void };
    };
  }
}

/** 다음 우편번호 스크립트를 1회 로드한다. */
function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.daum?.Postcode) return resolve();
    const existing = document.getElementById("daum-postcode-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load error")));
      return;
    }
    const s = document.createElement("script");
    s.id = "daum-postcode-script";
    s.src = DAUM_POSTCODE_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load error"));
    document.body.appendChild(s);
  });
}

export default function ApplyPage() {
  const [gender, setGender] = useState<"male" | "female">("male");
  const [birthDate, setBirthDate] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthTime, setBirthTime] = useState("");
  const [address, setAddress] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const [searching, setSearching] = useState(false);
  const postcodeBoxRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderId: string } | null>(null);

  const birthYear = birthDate.slice(0, 4);

  const canSubmit =
    birthDate &&
    (timeUnknown || birthTime !== "") &&
    consent &&
    !submitting;

  async function openAddressSearch() {
    setError(null);
    try {
      await loadDaumPostcode();
      // 팝업(.open) 대신 페이지 내 임베드(.embed) — 모바일·인앱 브라우저에서 안정적.
      setSearching(true);
      requestAnimationFrame(() => {
        const box = postcodeBoxRef.current;
        if (!box || !window.daum) return;
        box.innerHTML = "";
        new window.daum.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: (data) => {
            setAddress(data.roadAddress || data.jibunAddress);
            setSearching(false);
          },
        }).embed(box);
      });
    } catch {
      setError("주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const [y, m, d] = birthDate.split("-").map(Number);
      let hour: number | null = null;
      let minute: number | null = null;
      if (!timeUnknown && birthTime) {
        const [hh, mm] = birthTime.split(":").map(Number);
        hour = hh;
        minute = mm;
      }

      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "premium",
          birthYear: y,
          birthMonth: m,
          birthDay: d,
          birthHour: hour,
          birthMinute: minute,
          gender,
          address: address.trim() || undefined,
          currentSchool: currentSchool.trim() || undefined,
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
      setDone({ orderId: data.orderId });
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
              보통 몇 분 이내에 완성되며, 완성되면 입력하신 연락처로 결과 링크를 보내 드립니다.
            </p>
            <p className={styles.hint}>접수번호: {done.orderId}</p>
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

        {/* 아이 정보 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>아이 정보</h2>

          <div className={styles.field}>
            <label className={styles.label}>생년월일 (양력)</label>
            <input
              className={styles.input}
              type="date"
              value={birthDate}
              min={MIN_DATE}
              max={MAX_DATE}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <p className={styles.hint}>달력에서 고르거나 직접 입력할 수 있습니다.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>출생 시각</label>
            <input
              className={styles.input}
              type="time"
              value={birthTime}
              disabled={timeUnknown}
              onChange={(e) => setBirthTime(e.target.value)}
            />
            <label className={styles.checkRow} style={{ marginTop: 8 }}>
              <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
              <span>출생 시각을 모릅니다 (시주를 제외하고 풀이합니다)</span>
            </label>
            {(birthYear === "1987" || birthYear === "1988") && (
              <p className={styles.hint} style={{ marginTop: 8, color: "#7a5c1e" }}>
                ⓘ 1987·1988년은 서머타임(5~10월 시계 +1시간) 적용 연도입니다.
                출생증명서의 시각이 당시 시계 기준이면 그대로 입력하세요 — 해당 기간이면 자동 보정됩니다.
              </p>
            )}
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

        {/* 거주지 · 학교 (선택) */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>거주지 · 학교 (선택)</h2>
          <div className={styles.field}>
            <label className={styles.label}>주소 (선택)</label>
            <div className={styles.row}>
              <input
                className={styles.input}
                value={address}
                readOnly
                placeholder="‘주소 검색’을 눌러 선택하세요"
                onClick={openAddressSearch}
              />
              <button type="button" className={styles.addrBtn} onClick={openAddressSearch}>
                주소 검색
              </button>
            </div>
            {searching && (
              <div className={styles.postcodeWrap}>
                <div ref={postcodeBoxRef} className={styles.postcodeBox} />
                <button
                  type="button"
                  className={styles.addrClear}
                  onClick={() => setSearching(false)}
                >
                  주소 검색 닫기
                </button>
              </div>
            )}
            {address && !searching && (
              <button type="button" className={styles.addrClear} onClick={() => setAddress("")}>
                주소 지우기
              </button>
            )}
            <p className={styles.hint}>
              주소를 선택하시면 예상 배정 학교·반경 학교군 안내가 함께 제공됩니다.
              비워 두면 사주 해석만 제공됩니다. (사주 계산에는 출생지·주소가 쓰이지 않습니다.)
            </p>
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
          {submitting ? "접수 중…" : `신청하기 (${PRICE}원)`}
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
