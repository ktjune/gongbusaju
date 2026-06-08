/**
 * lib/schools — 사실 레이어 (학교·통학구역 데이터)
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 * 두 레이어를 합치는 곳은 오직 lib/report 이다.
 *
 * TODO [빌드 순서 3단계]: /data-pipeline + /lib/schools 구현
 *   - geocode.ts  주소 → 좌표
 *   - zone.ts     PostGIS point-in-polygon
 *   - query.ts    학교군 조인
 */

export type School = {
  name: string;
  type: string;
  distanceM: number;
  admissionStats?: Record<string, unknown>;
  /** 출처 URL 또는 공공데이터포털 데이터셋 ID */
  source: string;
  /** 데이터 기준일 (YYYY-MM-DD) */
  asOf: string;
};

export type SchoolFacts = {
  /** 예상 배정 학교 (교육청 확인 필요) */
  assignedSchool?: School;
  cluster: School[];
  source: string;
  asOf: string;
};

// placeholder — 구현 예정
export {};
