/**
 * lib/report/illustrations.ts
 * 일간(日干) 10종 형상 일러스트 — 한 장 요약 형상 카드용.
 *
 * public/illust/*.png (AI 생성, 480px·압축)을 일간별로 매핑해 <img>로 삽입한다.
 * 리포트 톤(종이색·네이비·골드)에 맞춘 담채 일러스트. 결정론적, LLM 미관여.
 */

/** 일간 → 이미지 파일명(public/illust/*.png) */
const ILLUST_FILE: Record<string, string> = {
  甲: "gap",     // 청룡등천
  乙: "eul",     // 난초
  丙: "byeong",  // 단봉조양
  丁: "jeong",   // 별빛 등불
  戊: "mu",      // 중산장옥
  己: "gi",      // 옥토
  庚: "gyeong",  // 명검
  辛: "sin",     // 봉함주
  壬: "im",      // 백천귀해
  癸: "gye",     // 단비
};

/** 접근성 라벨 */
const ILLUST_LABEL: Record<string, string> = {
  甲: "하늘로 오르는 큰 나무 형상",
  乙: "바람에 향을 퍼뜨리는 난초 형상",
  丙: "아침 해를 향해 날개를 펴는 형상",
  丁: "어둠 속 별빛과 등불 형상",
  戊: "옥을 품은 큰 산 형상",
  己: "씨앗을 길러 내는 기름진 밭 형상",
  庚: "불에 벼려지는 명검 형상",
  辛: "보석을 품은 봉황 형상",
  壬: "물길이 모여드는 큰 바다 형상",
  癸: "단비가 새싹을 틔우는 형상",
};

/** 일간 글자 → 형상 일러스트 <img> (미정의면 빈 문자열) */
export function dayMasterIllust(stem: string): string {
  const file = ILLUST_FILE[stem];
  if (!file) return "";
  const label = ILLUST_LABEL[stem] ?? "형상 일러스트";
  return `<img class="imagery-img" src="/illust/${file}.png" alt="${label}" width="160" height="160" loading="lazy" />`;
}
