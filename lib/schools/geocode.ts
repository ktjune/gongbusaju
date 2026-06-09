/**
 * lib/schools/geocode.ts
 * 주소 → WGS84 좌표 변환
 *
 * 기본: 카카오 Local API (KAKAO_REST_API_KEY 환경변수)
 * 키 없음: null 반환 (테스트·개발 시 직접 좌표 주입 가능)
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 *
 * TODO: VWorld API, 도로명주소 API 등 대체 공급자 추가
 */

import type { Coordinate } from "./types";

const KAKAO_GEOCODE_URL =
  "https://dapi.kakao.com/v2/local/search/address.json";

/**
 * 주소 문자열을 WGS84 좌표로 변환한다.
 *
 * @returns 좌표 또는 null (API 키 없음 / 주소 불인식 / 네트워크 오류)
 */
export async function geocodeAddress(
  address: string
): Promise<Coordinate | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({ query: address });
    const res = await fetch(`${KAKAO_GEOCODE_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      documents?: Array<{ x: string; y: string }>;
    };
    const docs = data.documents;
    if (!docs?.length) return null;

    return {
      lat: parseFloat(docs[0].y),
      lng: parseFloat(docs[0].x),
    };
  } catch {
    return null;
  }
}
