# 공부사주 (가칭)

공부·진로 사주 리포트 유료 서비스. Next.js 15 + Supabase + Prisma.

상세 설계: [SPEC.md](./SPEC.md) · 절대 규칙: [CLAUDE.md](./CLAUDE.md)

---

## 개발 시작

```bash
npm install
npm test        # vitest 단위 테스트
npm run dev     # Next.js 개발 서버
npm run lint    # ESLint (lib/saju ↔ lib/schools import 경계 포함)
```

---

## 만세력 정확도 안내

### 자체 일관성 vs 외부 권위 대조

현재 만세력 계산은 [lunar-javascript](https://github.com/6tail/lunar-javascript) 라이브러리를 사용합니다.
테스트는 라이브러리 내 일관성(같은 입력 → 같은 출력)을 검증합니다.

**TODO [외부 권위 대조]**: 한국천문연구원(KASI) 역법 또는 국내 권위 만세력과 결과를 대조해야 합니다.
이 작업이 완료되기 전까지 결과를 "정확하다"고 단정하지 마십시오.

### 서머타임(일광절약시간) 안내

한국 서머타임 적용 연도의 출생 시각은 보정이 필요할 수 있습니다.
현재 서머타임 보정 로직은 미구현 상태입니다(**TODO**).

**알려진 서머타임 적용 연도 (확인 필요)**:
- 1948년 ~ 1960년대 일부
- 1987년 ~ 1988년

위 연도에 태어난 사용자는 실제 사용한 시간(표준시/서머타임 여부)을 직접 확인하여
입력해야 정확한 時柱를 계산할 수 있습니다.

> 서머타임 적용 정확한 연도·기간은 행정안전부 고시 또는 국가기록원 자료를 참조하세요.

### 진태양시(眞太陽時) 보정

한국 표준시(KST)는 동경 135° 기준이나, 실제 한국 중앙 경도는 약 127~128°입니다.
서울 기준 약 **-32분** 차이가 나며, 이 차이로 時柱(시주)가 바뀔 수 있습니다.

기본값으로 진태양시 보정을 적용합니다(`useTrueSolarTime: true`).
보정 없이 계산하려면 `useTrueSolarTime: false`를 전달하세요.

---

## 레이어 구조

```
lib/saju    ← 해석 레이어 (결정론, LLM 없음)
lib/schools ← 사실 레이어 (사주 import 금지)
lib/report  ← 유일하게 두 레이어를 합치는 곳
```

ESLint `no-restricted-imports` 룰로 `lib/saju ↔ lib/schools` 상호 import를 에러 처리합니다.
