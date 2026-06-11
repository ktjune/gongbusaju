"""
data-pipeline/scripts/convertZones.py
초등학교 통학구역 SHP(EPSG:5186 중부원점) → WGS84 GeoJSON(ZoneCollection)

실행: python data-pipeline/scripts/convertZones.py <shp경로없이베이스명> [--sido 11]
  예: python data-pipeline/scripts/convertZones.py "C:/.../초등학교통학구역" --sido 11

출력: data-pipeline/output/zones.json  (lib/schools ZoneCollection 형식)
  properties.schoolId = HAKGUDO_ID, schoolName = 학구명에서 파생한 학교명.
  좌표는 [lng, lat] 6자리. point-in-polygon은 ring 방향 무관(ray-casting).

원본: 전국초등학교통학구역표준데이터 (data.go.kr/data/15021149)
"""

import json
import os
import sys

import shapefile  # pyshp
from pyproj import Transformer

# ── 인자 ─────────────────────────────────────────────
args = sys.argv[1:]
if not args:
    print("사용법: python convertZones.py <shp베이스경로> [--sido NN]")
    sys.exit(1)
base = args[0]
sido_filter = args[args.index("--sido") + 1] if "--sido" in args else None

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)
suffix = f"_sido{sido_filter}" if sido_filter else ""
out_path = os.path.join(OUT_DIR, f"zones{suffix}.json")

# EPSG:5186 (Korea 2000 중부원점) → EPSG:4326 (WGS84)
transformer = Transformer.from_crs("EPSG:5186", "EPSG:4326", always_xy=True)

SOURCE = "전국초등학교통학구역표준데이터(data.go.kr/data/15021149)"


def school_name_from_zone(zone_nm: str) -> str:
    """'경포초통학구역' → '경포초등학교', '서울개봉초등학교통학구역' → '서울개봉초등학교'"""
    nm = zone_nm
    for suf in ("통학구역", "공동통학구역"):
        if nm.endswith(suf):
            nm = nm[: -len(suf)]
            break
    # '경포초' → '경포초등학교' (이미 '초등학교'로 끝나면 그대로)
    if nm.endswith("초") and not nm.endswith("초등학교"):
        nm = nm + "등학교"
    return nm


def convert_ring(ring):
    """[(x,y), ...] (5186) → [[lng,lat], ...] (4326, 6자리)"""
    out = []
    for x, y in ring:
        lng, lat = transformer.transform(x, y)
        out.append([round(lng, 6), round(lat, 6)])
    return out


shp = shapefile.Reader(base, encoding="euc-kr")
fields = [f[0] for f in shp.fields[1:]]  # DeletionFlag 제외

features = []
skipped = 0
base_dt = None

for sr in shp.iterShapeRecords():
    rec = sr.record.as_dict()
    if sido_filter and str(rec.get("SD_CD", "")) != sido_filter:
        continue
    if base_dt is None:
        base_dt = rec.get("BASE_DT", "")

    geo = sr.shape.__geo_interface__  # ESRI ring orientation 해석 → Polygon/MultiPolygon
    gtype = geo["type"]
    coords = geo["coordinates"]

    if gtype == "Polygon":
        new_coords = [convert_ring(r) for r in coords]
    elif gtype == "MultiPolygon":
        new_coords = [[convert_ring(r) for r in poly] for poly in coords]
    else:
        skipped += 1
        continue

    zone_nm = rec.get("HAKGUDO_NM", "") or ""
    features.append({
        "type": "Feature",
        "geometry": {"type": gtype, "coordinates": new_coords},
        "properties": {
            "schoolId": rec.get("HAKGUDO_ID", ""),
            "schoolName": school_name_from_zone(zone_nm),
            "zoneName": zone_nm,
            "sidoCode": rec.get("SD_CD", ""),
            "sggCode": rec.get("SGG_CD", ""),
            "eduOffice": rec.get("EDU_NM", ""),
            "source": SOURCE,
            "asOf": rec.get("BASE_DT", "") or base_dt or "",
        },
    })

collection = {"type": "FeatureCollection", "features": features}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(collection, f, ensure_ascii=False, separators=(",", ":"))

size_mb = os.path.getsize(out_path) / (1024 * 1024)
print(f"변환 완료: {len(features)}개 구역 (스킵 {skipped})")
print(f"기준일: {base_dt}")
print(f"저장: {out_path} ({size_mb:.1f} MB)")
if features:
    p = features[0]["properties"]
    print(f"샘플: {p['zoneName']} → {p['schoolName']} (시도 {p['sidoCode']})")
