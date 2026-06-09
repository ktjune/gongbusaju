/**
 * lib/schools/types.ts
 * 사실 레이어(schools) 공개 타입
 *
 * [절대 규칙] lib/schools 는 lib/saju 를 절대 import 하지 않는다.
 */

/** WGS84 좌표 */
export type Coordinate = {
  lat: number;
  lng: number;
};

/** 학교 정보 (사실) */
export type SchoolRecord = {
  schoolId: string;        // NEIS 학교 코드
  name: string;
  type: string;            // "초등학교" | "중학교" | "고등학교"
  address: string;
  lat: number;
  lng: number;
  distanceM: number;       // 요청 좌표까지 거리(미터)
  admissionStats?: Record<string, unknown>; // TODO: 학교알리미 연동 후 채움
  /** 공공데이터 출처 (데이터셋 ID 또는 URL) */
  source: string;
  /** 데이터 기준일 YYYY-MM-DD */
  asOf: string;
};

/** getSchoolFacts() 반환 타입 (SPEC §5 SchoolFacts) */
export type SchoolFacts = {
  /**
   * 예상 배정 학교
   * 항상 "예상 배정(교육청 확인 필요)" 라벨을 포함한다.
   */
  assignedSchool?: SchoolRecord & {
    assignedLabel: "예상 배정(교육청 확인 필요)";
  };
  /** 반경 2km 이내 학교군 */
  cluster: SchoolRecord[];
  /** 데이터 출처 요약 */
  source: string;
  /** 데이터 기준일 */
  asOf: string;
};

// ──────────────────────────────────────────────────────────────
// GeoJSON 타입 (통학구역 폴리곤용 최소 정의)
// ──────────────────────────────────────────────────────────────

export type GeoJsonPosition = [number, number]; // [lng, lat]
export type GeoJsonLinearRing = GeoJsonPosition[];
export type GeoJsonPolygonCoords = GeoJsonLinearRing[];          // [exterior, ...holes]
export type GeoJsonMultiPolygonCoords = GeoJsonPolygonCoords[]; // array of polygons

export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: GeoJsonPolygonCoords }
  | { type: "MultiPolygon"; coordinates: GeoJsonMultiPolygonCoords };

export type ZoneProperties = {
  schoolId: string;
  schoolName?: string;
  source: string;
  asOf: string;
  note?: string;
};

export type ZoneFeature = {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: ZoneProperties;
};

export type ZoneCollection = {
  type: "FeatureCollection";
  features: ZoneFeature[];
};
