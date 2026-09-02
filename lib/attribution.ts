/**
 * lib/attribution.ts — 유입 경로 수집 (클라이언트 전용)
 *
 * 왜 GA4로 부족한가: GA4 표준 보고서는 확정에 24~48시간이 걸린다. 실제로 9/1 밤에 들어온
 * 결제가 어느 채널에서 왔는지 이틀이 지나도 알 수 없었다. 광고를 켜고 끌 판단이
 * 그만큼 늦는다. 결제되는 순간 주문에 같이 박아두면 그 지연이 사라진다.
 *
 * 개인정보는 담지 않는다 — 캠페인 이름·유입 도메인·진입 경로뿐이다.
 * 저장은 sessionStorage(탭 단위). 방문 한 번 = 주문 한 건에 대응한다.
 *
 * 측정이 실패해도 신청·결제는 그대로 굴러가야 한다 — 모든 접근을 try/catch로 감싼다.
 */

const KEY = "gbg_attribution";
const MAX = 200; // 값 하나당 길이 상한 — 긴 쿼리스트링이 통째로 들어오는 걸 막는다

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  /** 외부 유입 도메인. UTM이 없는 검색·카톡 유입의 유일한 단서 */
  referrer?: string;
  /** 첫 진입 경로 — 광고 랜딩(/case)이 실제로 파는지 본다 */
  landingPath?: string;
};

const clean = (v: string | null): string | undefined => {
  const s = v?.trim();
  return s ? s.slice(0, MAX) : undefined;
};

/** 같은 사이트 안에서의 이동은 유입이 아니다 — 외부 도메인만 남긴다. */
function externalReferrerHost(): string | undefined {
  try {
    const ref = document.referrer;
    if (!ref) return undefined;
    const host = new URL(ref).hostname;
    return host && host !== window.location.hostname ? host.slice(0, MAX) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 첫 진입 시 유입 경로를 저장한다.
 *
 * UTM이 붙어 있으면 **항상 덮어쓴다** — 광고를 새로 눌러 들어온 것이 가장 정확한 출처다.
 * UTM이 없으면 **비어 있을 때만** 쓴다 — 사이트 안을 돌아다녔다고 최초 유입이 지워지면 안 된다.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const utm: Attribution = {
      utmSource: clean(p.get("utm_source")),
      utmMedium: clean(p.get("utm_medium")),
      utmCampaign: clean(p.get("utm_campaign")),
      utmContent: clean(p.get("utm_content")),
    };
    const hasUtm = Object.values(utm).some(Boolean);
    if (!hasUtm && window.sessionStorage.getItem(KEY)) return;

    const data: Attribution = {
      ...utm,
      referrer: externalReferrerHost(),
      landingPath: clean(window.location.pathname),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 차단(시크릿 모드 등) — 측정만 못 할 뿐 결제는 그대로 진행된다 */
  }
}

/**
 * 클라이언트가 보낸 유입 경로를 저장 가능한 형태로 걸러낸다 (서버에서 호출).
 *
 * 값은 전부 사용자가 URL로 넘긴 문자열이라 그대로 믿지 않는다 — 길이를 자르고
 * 제어문자를 걷어낸다. 어드민 화면에 그대로 뿌려지는 값이기도 하다.
 */
export function sanitizeAttribution(input: unknown): Attribution {
  if (!input || typeof input !== "object") return {};
  const src = input as Record<string, unknown>;
  const take = (k: keyof Attribution): string | undefined => {
    const v = src[k];
    if (typeof v !== "string") return undefined;
    // 제어문자 제거 — 정규식에 제어문자를 직접 쓰면 소스가 깨진다
    const s = [...v]
      .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
      .join("")
      .trim();
    return s ? s.slice(0, MAX) : undefined;
  };
  return {
    utmSource: take("utmSource"),
    utmMedium: take("utmMedium"),
    utmCampaign: take("utmCampaign"),
    utmContent: take("utmContent"),
    referrer: take("referrer"),
    landingPath: take("landingPath"),
  };
}

/** 유입 경로가 하나도 없는 주문을 부를 이름 (직접 방문·측정 차단·구버전 주문) */
export const UNKNOWN_CHANNEL = "미상";

/**
 * 사람이 읽을 채널 이름 — 어드민 매출표와 새 주문 알림이 같은 문자열을 쓰도록 한 곳에 둔다.
 *
 * utm_source가 있으면 그것을, 없으면 유입 도메인을, 둘 다 없으면 "미상".
 * 어떤 광고 문구가 팔았는지 알아야 하므로 utm_content(소재)까지 붙인다.
 */
export function describeChannel(
  a: Partial<Record<keyof Attribution, string | null | undefined>>
): string {
  const base = a.utmSource || a.referrer || UNKNOWN_CHANNEL;
  const medium = a.utmMedium ? ` / ${a.utmMedium}` : "";
  const content = a.utmContent ? ` · ${a.utmContent}` : "";
  return `${base}${medium}${content}`;
}

/** 주문 생성 시 서버로 함께 보낼 유입 경로를 읽는다. 없으면 빈 객체. */
export function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Attribution) : {};
  } catch {
    return {};
  }
}
