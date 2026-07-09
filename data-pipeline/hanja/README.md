# 한자 성명학 데이터 (hanja.json)

부모가 입력한 이름 한자의 **원획(성명학 획수)**·**자원오행**을 조회하기 위한 데이터.

## 생성
```
python3 data-pipeline/hanja/build_hanja.py   # → hanja.json (약 8,500자)
```

## 출처 (모두 공개·자유이용)
- **획수·부수**: Unicode Unihan (kRSUnicode, kTotalStrokes) — Unicode License
- **부수원획 214**: Unihan에서 자동 도출 (강희부수 U+2F00~ → 정자체 → 획수)
- **원획 계산**: `원획 = 부수원획[R] + 나머지획수` (성명학 표준, 검증 19/19)
- **자원오행**: `build_hanja.py`의 부수→오행 매핑 (전통 부수 계열, **유파차 있음 = 참고용**)
- **특수획수**: STROKE_EXCEPTIONS (成=7 등 전통 예외)

## 형식
`{ "福": {"strokes":14,"radical":113,"element":"金","sound":"복"}, ... }`

## 주의
- 자원오행은 부수 계열 기반 v1 (참고). 더 권위 있는 표 확보 시 매핑 교체.
- 수리사격(획수 길흉) 판정은 낙인·개명 리스크로 **미구현** (자원오행 보완만).
