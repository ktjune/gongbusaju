/**
 * lib/report/josa.ts
 * 한글 조사(은/는, 이/가, 을/를) 자동 선택 — 이름 개인화 문구 조립용.
 * 마지막 글자의 받침 유무로 판정한다. 한글 음절이 아니면 받침 없는 형태로 폴백.
 */

/** 단어 끝 글자에 받침이 있는지. 한글 음절이 아니면 null. */
function hasBatchim(word: string): boolean | null {
  const ch = word.trim().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null; // 한글 완성형 음절 아님
  return (code - 0xac00) % 28 !== 0;
}

/** 은/는 (주제격) */
export function topicParticle(word: string): string {
  return hasBatchim(word) === true ? "은" : "는";
}

/** 이/가 (주격) */
export function subjectParticle(word: string): string {
  return hasBatchim(word) === true ? "이" : "가";
}

/** 을/를 (목적격) */
export function objectParticle(word: string): string {
  return hasBatchim(word) === true ? "을" : "를";
}
