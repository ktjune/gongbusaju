#!/usr/bin/env python3
"""
data-pipeline/hanja/build_hanja.py
한자 성명학 데이터 생성 — 원획(성명학 획수) + 부수 자원오행.

재료(모두 공개·자유이용):
  - Unicode Unihan (kRSUnicode, kTotalStrokes) — 부수·획수. Unicode License.
  - 강희부수 214 → 원획: Unihan에서 자동 도출(수작업 없음).
  - 부수 → 자원오행: 아래 RADICAL_ELEMENT (전통 부수 계열, 유파차 있음 = 참고).
  - 성명학 특수 획수 예외: STROKE_EXCEPTIONS.

출력: hanja.json  { "福": {"strokes":14,"radical":113,"element":"金"}, ... }
실행: python3 data-pipeline/hanja/build_hanja.py
"""
import io, os, re, sys, json, zipfile, unicodedata, urllib.request

OUT = os.path.join(os.path.dirname(__file__), "hanja.json")
UNIHAN_URL = "https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip"

# ── 부수(214) → 자원오행 ────────────────────────────────────
# 명확한 자연·재질·장부 부수는 확정, 추상 부수는 관례 배정. (부수 계열 참고, 유파차 있음)
RADICAL_ELEMENT = {
    # 木 — 나무·풀·곡물·성장
    75:"木",118:"木",140:"木",115:"木",119:"木",199:"木",200:"木",202:"木",
    179:"木",97:"木",100:"木",45:"木",2:"木",5:"木",160:"木",192:"木",
    # 火 — 불·해·빛·심장·색(적)
    86:"火",72:"火",155:"火",3:"火",134:"火",135:"火",61:"火",83:"火",
    130:"火",99:"火",154:"火",# 貝(재화)→火(교역)
    # 土 — 흙·산·돌·밭·기와·집
    32:"土",46:"土",112:"土",102:"土",170:"土",166:"土",121:"土",98:"土",
    201:"土",27:"土",53:"土",40:"土",44:"土",163:"土",92:"土",81:"土",
    206:"土",117:"土",114:"土",
    # 金 — 쇠·옥·칼·도끼·창·뼈·이·말(언)·흰빛
    167:"金",96:"金",18:"金",69:"金",62:"金",111:"金",106:"金",188:"金",
    211:"金",149:"金",210:"金",56:"金",57:"金",148:"金",26:"金",110:"金",
    # 水 — 물·비·얼음·물고기·강·피·귀·검정
    85:"水",173:"水",15:"水",195:"水",213:"水",47:"水",143:"水",150:"水",
    137:"水",164:"水",197:"水",128:"水",203:"水",116:"水",
}

# 추상·기타 부수 기본 배정(관례) — 위에 없는 것들
RADICAL_ELEMENT_DEFAULT = {
    1:"土",4:"金",6:"金",7:"火",8:"火",9:"火",10:"木",11:"木",12:"金",13:"木",
    14:"水",16:"金",17:"水",19:"土",20:"木",21:"金",22:"土",23:"土",24:"木",25:"火",
    28:"土",29:"水",30:"水",31:"土",33:"金",34:"火",35:"火",36:"火",37:"木",38:"土",
    39:"水",41:"金",42:"金",43:"火",48:"木",49:"土",50:"木",51:"木",52:"火",54:"火",
    55:"木",58:"水",59:"火",60:"火",63:"木",64:"木",65:"木",66:"金",67:"火",68:"土",
    70:"土",71:"火",73:"火",74:"水",76:"金",77:"土",78:"水",79:"金",80:"水",82:"火",
    84:"木",87:"金",88:"火",89:"火",90:"木",91:"木",93:"土",94:"金",95:"木",101:"火",
    103:"土",104:"水",105:"火",107:"金",108:"金",109:"木",113:"金",120:"木",122:"木",
    123:"土",124:"木",125:"火",126:"木",127:"金",129:"金",131:"金",132:"火",133:"火",
    136:"土",138:"木",139:"火",141:"木",142:"水",144:"火",145:"金",146:"木",147:"金",
    151:"木",152:"水",153:"土",156:"土",157:"水",158:"火",159:"火",161:"土",162:"土",
    165:"金",168:"火",169:"木",171:"土",172:"火",174:"木",175:"金",176:"水",177:"金",
    178:"金",180:"金",181:"火",182:"木",183:"木",184:"水",185:"火",186:"水",187:"火",
    189:"木",190:"木",191:"金",193:"火",194:"火",196:"火",198:"木",204:"木",205:"水",
    207:"金",208:"水",209:"金",212:"土",214:"土",
}

# 성명학 특수 획수 예외 (원획 공식과 다른 전통 획수)
STROKE_EXCEPTIONS = {"成":7}

def radical_element(r):
    return RADICAL_ELEMENT.get(r) or RADICAL_ELEMENT_DEFAULT.get(r) or "土"

def main():
    print("Unihan 다운로드…")
    raw = urllib.request.urlopen(UNIHAN_URL, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    src = z.read("Unihan_IRGSources.txt").decode("utf-8", "ignore")

    # 한국어 독음(kHangul) 있는 한자만 = 한국에서 쓰는 한자로 범위 한정 + 독음 확보
    readings = z.read("Unihan_Readings.txt").decode("utf-8", "ignore")
    hangul = {}
    for line in readings.splitlines():
        if line.startswith("#") or "\t" not in line:
            continue
        cp, f, v = line.split("\t", 2)
        if f == "kHangul":
            # "복:0E" 형태 → 첫 독음
            hangul[int(cp[2:], 16)] = v.split()[0].split(":")[0]

    total, rs = {}, {}
    for line in src.splitlines():
        if line.startswith("#") or "\t" not in line:
            continue
        cp, f, v = line.split("\t", 2)
        code = int(cp[2:], 16)
        if f == "kTotalStrokes":
            total[code] = int(v.split()[0])
        elif f == "kRSUnicode":
            rs[code] = v.split()[0]

    # 부수원획 214 자동 도출: 강희부수 U+2F00+(n-1) → 정자체 → kTotalStrokes
    rad_stroke = {}
    for n in range(1, 215):
        ch = unicodedata.normalize("NFKD", chr(0x2F00 + n - 1))[0]
        rad_stroke[n] = total.get(ord(ch))
    assert not [n for n in range(1, 215) if not rad_stroke[n]], "부수원획 누락"

    out = {}
    for code, v in rs.items():
        if code not in hangul:  # 한국어 독음 없는 한자 제외
            continue
        ch = chr(code)
        m = re.match(r"(\d+)\.?(-?\d+)?", v)
        if not m:
            continue
        R = int(m.group(1)); rem = int(m.group(2) or 0)
        strokes = STROKE_EXCEPTIONS.get(ch, rad_stroke[R] + rem)
        out[ch] = {
            "strokes": strokes,
            "radical": R,
            "element": radical_element(R),
            "sound": hangul[code],
        }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"→ {OUT}  ({len(out):,}자)")

    # 검증
    known = {"福":14,"蘭":23,"水":4,"木":4,"一":1,"江":7,"情":12,"思":9,"道":16,
             "花":10,"金":8,"俊":9,"書":10,"漢":15,"李":7,"眞":10,"龍":16,"鎬":18,"成":7}
    ok = sum(1 for c,e in known.items() if out.get(c,{}).get("strokes")==e)
    print(f"획수 검증 {ok}/{len(known)}")
    for c in ["木","水","金","土","火","福","江","俊"]:
        print(f"  {c}: {out.get(c)}")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
