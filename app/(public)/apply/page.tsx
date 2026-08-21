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
import * as PortOne from "@portone/browser-sdk/v2";
import { isValidEmail, isValidKoreanMobile } from "@/lib/validate/contact";
import styles from "./apply.module.css";

const PRICE = "9,900";
const PRICE_VALUE = 9900;
const MIN_DATE = "1980-01-01";
const MAX_DATE = new Date().toISOString().slice(0, 10);
// 서비스 제공기간 — 이용약관·상품 상세와 동일하게 "결제 후 1일 이내"
const OFFER_PERIOD_MS = 24 * 60 * 60 * 1000;
// 포트원 V2 — PG(현재 NHN KCP)는 채널 설정으로 결정된다
const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "";
const ORDER_PAYLOAD_KEY = "gbsj_order_payload";
const GATE_TOKEN_KEY = "gbsj_gate_token";
// 심사 모드 잠금 여부 — 서버의 ORDER_GATE_TOKEN과 짝을 이룬다(둘 다 설정하거나 둘 다 비운다)
const GATE_ENABLED = (process.env.NEXT_PUBLIC_ORDER_GATE ?? "") === "1";
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

/**
 * 포트원 offerPeriod는 오프셋이 명시된 RFC3339 시각을 받는다.
 * toISOString()의 Z 표기 대신 KST(+09:00)로 넘겨야 결제창에 우리 기준 시각이 뜬다.
 */
function toKstRfc3339(ms: number): string {
  return `${new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 19)}+09:00`;
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

// ── 한자 탭 선택 (모바일에서 한자 타이핑이 어렵다는 피드백 대응) ──
type HanjaCand = { c: string; strokes: number; element: string };
const EL_HANGUL: Record<string, string> = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
const EL_COLOR: Record<string, string> = {
  木: "#3d9a50", 火: "#d64545", 土: "#c9a227", 金: "#8e9aa8", 水: "#3b6fb5",
};
const hanjaChipStyle = (selected: boolean, element: string): React.CSSProperties => ({
  flex: "0 0 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "8px 12px",
  borderRadius: 10,
  border: selected ? `2px solid ${EL_COLOR[element] ?? "#1f3b63"}` : "1px solid #ddd6c8",
  background: selected ? "#fffdf5" : "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
});

export default function ApplyPage() {
  const [step, setStep] = useState<"form" | "pay">("form");

  // 심사 모드 통행 토큰 — /apply?k=... 로 들어오면 저장해 두고 주문 시 함께 보낸다.
  // 서버(ORDER_GATE_TOKEN)가 최종 판정하므로 여기 값은 안내용 게이트일 뿐이다.
  const [gateToken, setGateToken] = useState("");
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("k");
    if (fromUrl) sessionStorage.setItem(GATE_TOKEN_KEY, fromUrl);
    setGateToken(fromUrl ?? sessionStorage.getItem(GATE_TOKEN_KEY) ?? "");
  }, []);
  const orderLocked = GATE_ENABLED && !gateToken;

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

  // 한자 탭 선택 상태 — 음절별 후보(hanjaCands)에서 골라(hanjaSel) childNameHanja를 구성
  const [hanjaCands, setHanjaCands] = useState<Record<string, HanjaCand[]>>({});
  const [hanjaSel, setHanjaSel] = useState<Record<number, string>>({});
  const [hanjaManual, setHanjaManual] = useState(false);
  const nameSyllables = [...childName.trim()].filter((c) => /^[가-힣]$/.test(c));

  const [searching, setSearching] = useState(false);
  const postcodeBoxRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const birthYear = birthDate.slice(0, 4);

  // 리포트 전달용 — 이메일 또는 휴대폰 중 최소 하나는 필수 + 입력한 값은 형식이 맞아야 함
  const hasContact = contactEmail.trim() !== "" || contactPhone.trim() !== "";
  const emailInvalid = contactEmail.trim() !== "" && !isValidEmail(contactEmail);
  const phoneInvalid = contactPhone.trim() !== "" && !isValidKoreanMobile(contactPhone);
  const canProceed =
    birthDate &&
    (timeUnknown || birthTime !== "") &&
    hasContact &&
    !emailInvalid &&
    !phoneInvalid &&
    consent &&
    refundConsent;

  // 이름이 바뀌면 음절별 한자 후보를 조회하고 기존 선택을 초기화
  useEffect(() => {
    setHanjaSel({});
    if (!hanjaManual) setChildNameHanja("");
    const sylls = [...new Set([...childName.trim()].filter((c) => /^[가-힣]$/.test(c)))];
    if (sylls.length === 0) {
      setHanjaCands({});
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/hanja?name=${encodeURIComponent(sylls.join(""))}`)
        .then((r) => r.json())
        .then((d: { candidates?: Record<string, HanjaCand[]> }) => setHanjaCands(d.candidates ?? {}))
        .catch(() => {
          /* 후보 조회 실패 시 직접 입력으로 폴백 가능 — 조용히 무시 */
        });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childName]);

  /** i번째 음절의 한자를 선택/해제하고 childNameHanja를 재구성 */
  // (updater 함수 안에서 다른 setState를 부르면 StrictMode 2회 실행으로 토글이 상쇄됨 — 밖에서 계산)
  function pickHanja(i: number, c: string) {
    const next = { ...hanjaSel };
    if (next[i] === c) delete next[i];
    else next[i] = c;
    setHanjaSel(next);
    setChildNameHanja(nameSyllables.map((_, idx) => next[idx] ?? "").join(""));
  }

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

  function buildPayload(paymentId: string) {
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
      paymentId,
      gateToken: gateToken || undefined,
    };
  }

  /**
   * 포트원 결제 요청 → 성공 시 /order/result 로 이동해 주문 생성.
   *
   * 모바일은 외부 앱(카드사·간편결제)을 거쳐 redirectUrl로 돌아오고,
   * PC는 팝업에서 끝나 함수가 값을 반환한다 — 두 경로를 모두 처리한다.
   * 신청 데이터는 결제 전에 sessionStorage에 넣어 두고, 돌아온 뒤 꺼내 쓴다.
   */
  async function handlePay() {
    setError(null);
    setPaying(true);
    try {
      if (orderLocked) {
        throw new Error("현재 결제 준비 중입니다. 곧 정식 오픈합니다.");
      }
      if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
        throw new Error("결제 설정 오류(상점 정보 없음)");
      }
      const paymentId = `gbg_${crypto.randomUUID().replace(/-/g, "")}`;
      sessionStorage.setItem(ORDER_PAYLOAD_KEY, JSON.stringify(buildPayload(paymentId)));

      const res = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId,
        orderName: "공부결 리포트",
        totalAmount: PRICE_VALUE,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        // 디지털 콘텐츠 — 에스크로 대상이 아님을 명시하고, KCP 결제창의 "제공기간" 칸을 채운다
        productType: "PRODUCT_TYPE_DIGITAL",
        offerPeriod: {
          range: {
            from: toKstRfc3339(Date.now()),
            to: toKstRfc3339(Date.now() + OFFER_PERIOD_MS),
          },
        },
        // 모바일 리다이렉트 복귀 지점 — 이 경우 아래 코드는 실행되지 않는다
        redirectUrl: `${window.location.origin}/order/result`,
        customer: {
          email: contactEmail.trim() || undefined,
          phoneNumber: contactPhone.trim() || undefined,
        },
      });

      // PC 팝업 경로: 여기로 값이 돌아온다
      if (res?.code !== undefined) {
        // 사용자가 취소했거나 결제 실패 — 안내만 하고 폼에 머문다
        setError(res.message ?? "결제가 완료되지 않았습니다.");
        setPaying(false);
        return;
      }
      window.location.href = `/order/result?paymentId=${encodeURIComponent(paymentId)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제를 진행하지 못했습니다.");
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
          <p className={styles.subtitle}>공부결 리포트 1부 · {PRICE}원</p>

          {error && <div className={styles.error}>{error}</div>}

          {/* 포트원은 별도 위젯 영역 없이 버튼 클릭 시 결제창이 뜬다 */}
          <div className={styles.section}>
            <div className={styles.field}>
              <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={styles.label}>공부결 리포트 1부</span>
                <span className={styles.label}>{PRICE}원</span>
              </div>
              <div className={styles.row} style={{ justifyContent: "space-between" }}>
                <span className={styles.label}>서비스 제공 기간</span>
                <span className={styles.label}>결제 후 1일 이내</span>
              </div>
              <p className={styles.hint}>
                {orderLocked
                  ? "결제 시스템 점검 중입니다. 오픈 후 바로 신청하실 수 있습니다."
                  : "아래 버튼을 누르면 카드 결제창이 열립니다. 결제 후 리포트 제작이 자동으로 시작됩니다."}
              </p>
              <p className={styles.hint}>
                본 상품은 온라인으로 제작·전달되는 디지털 콘텐츠로,{" "}
                <b>결제 완료 후 1일(24시간) 이내 이용 가능</b>합니다. 완성되면 입력하신
                이메일·카카오로 결과 링크를 보내드립니다.
              </p>
            </div>

            {/* PG 입점 검수 요건 — 상품 상세에 서비스 제공기간·교환·환불·취소 규정을
                모두 노출해야 한다(링크만으로는 불충분). 내용은 이용약관 제7조와 동일. */}
            <div className={styles.notice}>
              <b>교환 · 환불 · 취소 규정</b>
              <br />
              · <b>취소/환불</b>: 리포트 <b>제작 착수 전</b>에는 전액 환불해 드립니다.
              회사 귀책으로 리포트가 제공되지 못한 경우에도 전액 환불합니다.
              <br />
              · <b>청약철회 제한</b>: 본 상품은 입력하신 정보로 개별 제작되는 디지털
              콘텐츠로, 제작·제공이 개시된 후에는 「전자상거래 등에서의 소비자보호에
              관한 법률」 제17조 제2항에 따라 단순 변심에 의한 청약철회가 제한됩니다.
              <br />
              · <b>교환</b>: 디지털 콘텐츠 특성상 동일 상품 교환은 제공하지 않으며,
              내용에 하자가 있는 경우 <b>재제작 또는 환불</b>로 처리해 드립니다.
              <br />
              · <b>신청 방법</b>:{" "}
              <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                환불 신청 페이지
              </a>
              에서 주문번호와 연락처로 접수하시거나, 전화(0502-1944-3249) 또는
              이메일(moondoor_main@naver.com)로 요청하실 수 있습니다.
            </div>
          </div>

          <button
            className={styles.submit}
            onClick={handlePay}
            disabled={paying || orderLocked}
          >
            {orderLocked
              ? "결제 준비 중 — 곧 오픈합니다"
              : paying
                ? "결제 진행 중…"
                : `${PRICE}원 결제하기`}
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
            결제는 안전하게 암호화되어 처리되며, 카드 정보는 저희 서버에 저장되지 않습니다.
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
            <label className={styles.label}>
              이름 (선택) <span style={{ fontWeight: 400, color: "#8a8f99" }}>— 성(姓)은 빼고 이름만</span>
            </label>
            <input
              className={styles.input}
              value={childName}
              maxLength={20}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="이름만 입력 (예: 준서)"
            />
            <p className={styles.hint}>
              성은 빼고 <b>이름만</b> 입력해 주세요 (예: 김준서 → 준서). 입력하시면 리포트
              표지·요약에 아이 이름으로 인사드립니다. 비워 두셔도 됩니다.
              (이름은 사주 계산·AI 해석에 사용되지 않습니다.)
            </p>
          </div>

          {nameSyllables.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>
                이름 한자 (선택) <span style={{ fontWeight: 400, color: "#8a8f99" }}>— 탭해서 고르세요</span>
              </label>
              <p className={styles.hint} style={{ marginTop: 0 }}>
                한자를 고르시면 <b>이름의 자원오행 풀이</b>(성명학 참고)를 리포트에 담아드립니다.
                모르시면 건너뛰셔도 됩니다.
              </p>
              {!hanjaManual ? (
                <>
                  {nameSyllables.map((s, i) => (
                    <div key={`${s}-${i}`} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f3b63", marginBottom: 5 }}>
                        {s}
                        {hanjaSel[i] && (
                          <span style={{ marginLeft: 6, fontWeight: 400, color: "#8a8f99" }}>
                            → {hanjaSel[i]} 선택됨
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                        {(hanjaCands[s] ?? []).map((cand) => (
                          <button
                            type="button"
                            key={cand.c}
                            onClick={() => pickHanja(i, cand.c)}
                            style={hanjaChipStyle(hanjaSel[i] === cand.c, cand.element)}
                          >
                            <span style={{ fontSize: "1.2rem", lineHeight: 1.2 }}>{cand.c}</span>
                            <span style={{ fontSize: "0.62rem", color: EL_COLOR[cand.element] ?? "#8a8f99" }}>
                              {cand.strokes}획·{EL_HANGUL[cand.element] ?? cand.element}
                            </span>
                          </button>
                        ))}
                        {(hanjaCands[s]?.length ?? 0) === 0 && (
                          <span style={{ fontSize: "0.82rem", color: "#9a9fa8", alignSelf: "center" }}>
                            후보를 찾지 못했어요 — 아래 직접 입력을 이용해 주세요
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addrClear}
                    onClick={() => {
                      setHanjaManual(true);
                      setHanjaSel({});
                      setChildNameHanja("");
                    }}
                  >
                    찾는 한자가 없나요? 직접 입력하기
                  </button>
                </>
              ) : (
                <>
                  <input
                    className={styles.input}
                    value={childNameHanja}
                    maxLength={20}
                    onChange={(e) => setChildNameHanja(e.target.value)}
                    placeholder="한자 직접 입력 (예: 俊書)"
                  />
                  <button
                    type="button"
                    className={styles.addrClear}
                    onClick={() => {
                      setHanjaManual(false);
                      setChildNameHanja("");
                    }}
                  >
                    ← 목록에서 탭으로 고르기
                  </button>
                </>
              )}
            </div>
          )}

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
            {/* 통학구역 공공데이터가 초등학교 기준이라, 중·고등학생은 예상 배정이
                나오지 않는다. 기대와 다른 결과로 문의가 생기지 않도록 미리 알린다. */}
            <p className={styles.hint}>
              주소를 입력하시면 <b>예상 배정 초등학교</b>와 주변 학교 정보를 함께 담아드립니다.
              통학구역 공공데이터가 초등학교 기준이라 <b>중·고등학생은 예상 배정 대신
              주변 학교 현황만</b> 제공됩니다. 배정 결과는 참고용이며 실제 배정은 교육청 확인이
              필요합니다.
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
            {emailInvalid && (
              <p className={styles.hint} style={{ color: "#a4442a" }}>
                이메일 형식이 올바르지 않습니다. (예: parent@example.com)
              </p>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>휴대폰 <span style={{ fontWeight: 400, color: "#8a8f99" }}>(둘 중 하나)</span></label>
            <input className={styles.input} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="010-0000-0000" />
            {phoneInvalid && (
              <p className={styles.hint} style={{ color: "#a4442a" }}>
                휴대폰 번호를 다시 확인해 주세요. (예: 010-1234-5678)
              </p>
            )}
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
              {" · "}
              <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>환불 신청</a>
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
