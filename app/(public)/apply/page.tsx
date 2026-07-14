"use client";

/**
 * /apply — 신청 폼 + 결제
 *
 * 1단계(form): 생년월일시·성별·(선택)주소/재학학교·연락처·동의 입력
 * 2단계(pay):  토스페이먼츠 결제위젯 → 결제 요청
 *
 * 결제 성공 시 토스가 /order/result 로 리다이렉트하며, 그 페이지가 서버에 결제 승인 +
 * 주문 생성을 요청한다. 신청 데이터는 결제 직전 sessionStorage에 저장해 전달한다.
 *
 * PII는 서버(/api/order)에서 즉시 암호화 저장 — 이 폼/세션스토리지는 평문을 잠시 보관만 한다.
 */

import { useEffect, useRef, useState } from "react";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import styles from "./apply.module.css";

const PRICE = "9,900";
const PRICE_VALUE = 9900;
const MIN_DATE = "1980-01-01";
const MAX_DATE = new Date().toISOString().slice(0, 10);
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
const ORDER_PAYLOAD_KEY = "gbsj_order_payload";
const DAUM_POSTCODE_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void;
      }) => { open: () => void; embed: (el: HTMLElement) => void };
    };
  }
}

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

// 토스 위젯 인스턴스 타입(부분) — SDK 반환값
type TossWidgets = {
  setAmount: (a: { value: number; currency: string }) => Promise<void>;
  renderPaymentMethods: (o: { selector: string; variantKey?: string }) => Promise<unknown>;
  renderAgreement: (o: { selector: string; variantKey?: string }) => Promise<unknown>;
  requestPayment: (o: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
  }) => Promise<void>;
};

export default function ApplyPage() {
  const [step, setStep] = useState<"form" | "pay">("form");

  const [childName, setChildName] = useState("");
  const [childNameHanja, setChildNameHanja] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [birthDate, setBirthDate] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthTime, setBirthTime] = useState("");
  const [address, setAddress] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [refundConsent, setRefundConsent] = useState(false);

  const [searching, setSearching] = useState(false);
  const postcodeBoxRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const widgetsRef = useRef<TossWidgets | null>(null);

  const birthYear = birthDate.slice(0, 4);

  // 리포트 전달용 — 이메일 또는 휴대폰 중 최소 하나는 필수
  const hasContact = contactEmail.trim() !== "" || contactPhone.trim() !== "";
  const canProceed =
    birthDate &&
    (timeUnknown || birthTime !== "") &&
    hasContact &&
    consent &&
    refundConsent;

  // 결제 단계 진입 시 토스 결제위젯 렌더
  useEffect(() => {
    if (step !== "pay") return;
    let cancelled = false;
    (async () => {
      try {
        if (!TOSS_CLIENT_KEY) throw new Error("결제 설정 오류(클라이언트 키 없음)");
        const toss = await loadTossPayments(TOSS_CLIENT_KEY);
        const widgets = toss.widgets({ customerKey: ANONYMOUS }) as unknown as TossWidgets;
        if (cancelled) return;
        widgetsRef.current = widgets;
        await widgets.setAmount({ value: PRICE_VALUE, currency: "KRW" });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
      } catch {
        if (!cancelled) setError("결제창을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  async function openAddressSearch() {
    setError(null);
    try {
      await loadDaumPostcode();
      setSearching(true);
      requestAnimationFrame(() => {
        const box = postcodeBoxRef.current;
        if (!box || !window.daum) return;
        box.innerHTML = "";
        new window.daum.Postcode({
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

  function buildPayload(tossOrderId: string) {
    const [y, m, d] = birthDate.split("-").map(Number);
    let hour: number | null = null;
    let minute: number | null = null;
    if (!timeUnknown && birthTime) {
      const [hh, mm] = birthTime.split(":").map(Number);
      hour = hh;
      minute = mm;
    }
    return {
      tier: "basic",
      name: childName.trim() || undefined,
      nameHanja: childNameHanja.trim() || undefined,
      birthYear: y,
      birthMonth: m,
      birthDay: d,
      birthHour: hour,
      birthMinute: minute,
      gender,
      address: address.trim() || undefined,
      currentSchool: currentSchool.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      consent,
      amount: PRICE_VALUE,
      tossOrderId,
    };
  }

  async function handlePay() {
    if (!widgetsRef.current) return;
    setError(null);
    setPaying(true);
    try {
      const tossOrderId = `gbsj_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      sessionStorage.setItem(ORDER_PAYLOAD_KEY, JSON.stringify(buildPayload(tossOrderId)));
      await widgetsRef.current.requestPayment({
        orderId: tossOrderId,
        orderName: "공부사주 리포트",
        successUrl: `${window.location.origin}/order/result`,
        failUrl: `${window.location.origin}/order/result`,
        customerEmail: contactEmail.trim() || undefined,
      });
      // requestPayment 성공 시 리다이렉트되므로 이 아래는 실행되지 않음
    } catch {
      // 사용자가 결제창을 닫는 등 — 조용히 복귀
      setPaying(false);
    }
  }

  // ── 결제 단계 ───────────────────────────────────────────
  if (step === "pay") {
    return (
      <div className={styles.page}>
        <div className={styles.sheet}>
          <div className={styles.badge}>공부·기질 사주 리포트</div>
          <h1 className={styles.title}>결제</h1>
          <p className={styles.subtitle}>공부사주 리포트 1부 · {PRICE}원</p>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.section}>
            <div id="payment-method" />
            <div id="agreement" />
          </div>

          <button className={styles.submit} onClick={handlePay} disabled={paying}>
            {paying ? "결제 진행 중…" : `${PRICE}원 결제하기`}
          </button>
          <button
            type="button"
            className={styles.addrClear}
            style={{ display: "block", margin: "12px auto 0" }}
            onClick={() => {
              setStep("form");
              setError(null);
            }}
          >
            ← 정보 다시 입력
          </button>

          <p className={styles.notice}>
            테스트 결제 환경입니다. 결제 성공 시 리포트 제작이 접수됩니다.
          </p>
        </div>
      </div>
    );
  }

  // ── 입력 단계 ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      <form
        className={styles.sheet}
        onSubmit={(e) => {
          e.preventDefault();
          if (canProceed) setStep("pay");
        }}
      >
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
            <label className={styles.label}>이름 (선택)</label>
            <div className={styles.row}>
              <input
                className={styles.input}
                value={childName}
                maxLength={20}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="예: 준서"
              />
              <input
                className={styles.input}
                value={childNameHanja}
                maxLength={20}
                onChange={(e) => setChildNameHanja(e.target.value)}
                placeholder="한자 (예: 俊書)"
              />
            </div>
            <p className={styles.hint}>
              이름을 입력하시면 리포트 표지·요약에 아이 이름으로 인사드립니다. 한자까지 넣으시면
              <b> 이름의 자원오행이 사주를 어떻게 보완하는지</b>(성명학 참고)도 풀이해 드립니다.
              비워 두셔도 됩니다. (이름·한자는 사주 계산·AI 해석에 사용되지 않습니다.)
            </p>
          </div>

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
                <button type="button" className={styles.addrClear} onClick={() => setSearching(false)}>
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
              재학 학교·주소는 리포트의 학령 단계 해석에 참고됩니다. 비워 두셔도 무방합니다.
              (사주 계산에는 출생지·주소가 쓰이지 않습니다.)
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
          <p className={styles.hint} style={{ marginTop: -4, marginBottom: 12 }}>
            완성된 리포트 링크를 보내드립니다. <b>이메일·휴대폰 중 하나만 입력하면 됩니다</b> (둘 다 넣으셔도 됩니다).
          </p>
          <div className={styles.field}>
            <label className={styles.label}>이메일 <span style={{ fontWeight: 400, color: "#8a8f99" }}>(둘 중 하나)</span></label>
            <input className={styles.input} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="parent@example.com" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>휴대폰 <span style={{ fontWeight: 400, color: "#8a8f99" }}>(둘 중 하나)</span></label>
            <input className={styles.input} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="010-0000-0000" />
          </div>
          {!hasContact && (
            <p className={styles.hint} style={{ color: "#a4442a" }}>
              이메일 또는 휴대폰 중 하나를 입력하셔야 신청할 수 있습니다.
            </p>
          )}
        </div>

        {/* 동의 */}
        <div className={styles.section}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              (필수) 만 14세 미만 자녀의 개인정보(생년월일시·주소·학교) 수집·이용에
              <b> 법정대리인으로서 동의</b>합니다. 정보는 암호화 저장되며 리포트 제작·보관기간(6개월) 후 파기됩니다.{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>개인정보처리방침</a>
              {" · "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>이용약관</a>
            </span>
          </label>

          <label className={styles.checkRow} style={{ marginTop: 12 }}>
            <input type="checkbox" checked={refundConsent} onChange={(e) => setRefundConsent(e.target.checked)} />
            <span>
              (필수) 개별 제작되는 리포트로, <b>제작 시작 후에는 단순 변심 환불이 어렵습니다.</b>{" "}
              <a href="/terms#refund" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>환불정책</a>
            </span>
          </label>
        </div>

        <button className={styles.submit} type="submit" disabled={!canProceed}>
          {`결제하기 (${PRICE}원)`}
        </button>

        <p className={styles.notice}>
          제작 전 취소는 전액 환불 · 리포트 내용에 오류가 있으면 재제작/환불해 드립니다.
        </p>
      </form>
    </div>
  );
}
