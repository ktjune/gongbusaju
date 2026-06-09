/**
 * lib/saju/hanzi.ts
 * 한자 ↔ 한글 병기 유틸 + 나이 표기 유틸
 *
 * 재사용 목적: 개발 검증 페이지, 리포트 템플릿, 상품 UI 모두에서 호출 가능.
 *
 * [한자 기준]
 * lunar-javascript는 간체 중국어(简体字)를 사용한다.
 * 십성은 간체 기준으로 매핑한다 (劫财, 偏财, 伤官, 七杀 등).
 *
 * [나이 기준]
 * lunar-javascript getStartAge()는 세는나이(虚岁) 기준이다.
 *   공식: startAge = startYear - birthYear + 1
 *   (태어난 해 = 1세, 매년 1월 1일에 +1세 — 생일 무관)
 * 한국 법령(2023년 6월~)은 만나이 통일.
 * 외부에 표시할 때는 만나이(= 세는나이 - 1)를 사용하고 "만 X세"로 명시한다.
 */

// ──────────────────────────────────────────────────────────────
// 한자 매핑 테이블
// ──────────────────────────────────────────────────────────────

/** 10天干 한자 → 한글 */
export const TIANGAN_KR: Record<string, string> = {
  甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무",
  己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계",
};

/** 12地支 한자 → 한글 */
export const DIZHI_KR: Record<string, string> = {
  子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사",
  午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해",
};

/** 五行 한자 → 한글 */
export const WUXING_KR: Record<string, string> = {
  木: "목", 火: "화", 土: "토", 金: "금", 水: "수",
};

/**
 * 十神 한자 → 한글
 * lunar-javascript 간체(简体) 기준:
 *   劫财(겁재), 偏财(편재), 正财(정재), 伤官(상관), 七杀(칠살)
 */
export const SHISHEN_KR: Record<string, string> = {
  比肩: "비견",
  劫财: "겁재",  // 간체: 財→财
  食神: "식신",
  伤官: "상관",  // 간체: 傷→伤
  偏财: "편재",  // 간체: 財→财
  正财: "정재",  // 간체: 財→财
  七杀: "칠살",  // 간체: 殺→杀
  正官: "정관",
  偏印: "편인",
  正印: "정인",
  // 전통체(번체) 대응 — 혹시 다른 소스와 섞일 경우 대비
  劫財: "겁재",
  偏財: "편재",
  正財: "정재",
  傷官: "상관",
  七殺: "칠살",
  偏官: "편관",  // 七杀의 별칭
};

// ──────────────────────────────────────────────────────────────
// 한자→한글 변환 함수
// ──────────────────────────────────────────────────────────────

/**
 * 간지(干支) 2글자를 한글 독음으로 변환한다.
 *
 * @example ganjiToHangul("甲子") → "갑자"
 * @example ganjiToHangul("乙丑") → "을축"
 * @returns 한글 독음 2자, 알 수 없는 글자는 "?"로 대체
 */
export function ganjiToHangul(ganji: string): string {
  if (!ganji || ganji.length < 2) return ganji ?? "";
  const gan = TIANGAN_KR[ganji[0]] ?? "?";
  const zhi = DIZHI_KR[ganji[1]] ?? "?";
  return gan + zhi;
}

/**
 * 간지(干支) 2글자를 "한자(한글)" 형식으로 반환한다.
 *
 * @example withHangul("甲子") → "甲子(갑자)"
 * @example withHangul("乙丑") → "乙丑(을축)"
 */
export function withHangul(ganji: string): string {
  const kr = ganjiToHangul(ganji);
  if (!kr || kr.includes("?")) return ganji;
  return `${ganji}(${kr})`;
}

/**
 * 오행(五行) 한자 1글자를 한글로 변환한다.
 *
 * @example wuxingToHangul("木") → "목"
 */
export function wuxingToHangul(wuxing: string): string {
  return WUXING_KR[wuxing] ?? wuxing;
}

/**
 * 오행(五行) 한자를 "木(목)" 형식으로 반환한다.
 */
export function wuxingWithHangul(wuxing: string): string {
  const kr = WUXING_KR[wuxing];
  return kr ? `${wuxing}(${kr})` : wuxing;
}

/**
 * 십성(十神) 한자를 한글로 변환한다.
 *
 * @example tenGodToHangul("正印") → "정인"
 * @example tenGodToHangul("劫财") → "겁재"
 */
export function tenGodToHangul(tengod: string): string {
  return SHISHEN_KR[tengod] ?? tengod;
}

/**
 * 십성(十神) 한자를 "正印(정인)" 형식으로 반환한다.
 *
 * @example tenGodWithHangul("正印") → "正印(정인)"
 * @example tenGodWithHangul("劫财") → "劫财(겁재)"
 */
export function tenGodWithHangul(tengod: string): string {
  const kr = SHISHEN_KR[tengod];
  return kr ? `${tengod}(${kr})` : tengod;
}

// ──────────────────────────────────────────────────────────────
// 나이 표기 유틸
// ──────────────────────────────────────────────────────────────

/**
 * lunar-javascript getStartAge() 반환값(세는나이/虚岁) → 만나이로 변환.
 *
 * lunar-javascript 세는나이 공식:
 *   startAge = startYear - birthYear + 1  (태어난 해 = 1세)
 * 만나이 = 세는나이 - 1  (태어난 해 = 0세, 생일 이후 +1)
 *
 * 주의: 이 변환은 연도 단위 근사값이다.
 * 정확한 만나이는 생년월일 vs 기준일을 비교해야 하지만,
 * 대운 표기처럼 연도 단위 표시에는 이 근사값으로 충분하다.
 *
 * @param senayi lunar-javascript getStartAge() 반환값 (세는나이)
 * @returns 만나이 (0 이상)
 */
export function seToMannai(senayi: number): number {
  return Math.max(0, senayi - 1);
}

/**
 * 세는나이를 "만 X세" 형식으로 반환한다.
 *
 * @example formatMannai(6) → "만 5세"
 * @example formatMannai(1) → "만 0세"
 */
export function formatMannai(senayi: number): string {
  return `만 ${seToMannai(senayi)}세`;
}

/**
 * 대운 시작 만나이(연·월)를 "만 X세 Y개월부터" 형식으로 반환한다.
 *
 * 입력값은 lunar-javascript Yun.getStartYear()/getStartMonth() — 출생 후 경과 시간이므로
 * 만나이와 동일. DaYun.getStartAge()(세는나이)와 혼동 금지.
 *
 * @param years  만나이 연 단위 (Yun.getStartYear() + n*10)
 * @param months 추가 개월 수 0~11 (Yun.getStartMonth())
 *
 * @example formatDaeunAge(5, 10) → "만 5세 10개월부터"
 * @example formatDaeunAge(15, 0) → "만 15세부터"
 */
export function formatDaeunAge(years: number, months: number): string {
  const monthPart = months > 0 ? ` ${months}개월` : "";
  return `만 ${years}세${monthPart}부터`;
}
