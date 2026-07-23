/**
 * GET /api/hanja?name=준서 — 이름 음절별 한자 후보 조회
 *
 * 모바일에서 한자를 직접 타이핑하기 어렵다는 피드백 대응:
 * 한글 이름의 각 음절에 해당하는 한자 후보(자원오행·원획 포함)를 돌려주고,
 * 신청 폼에서 탭으로 고르게 한다.
 *
 * 데이터: data-pipeline/hanja/hanja.json (Unihan 기반 — 한국어 독음 8,500여 자).
 * 개인정보 아님(이름은 조회에만 쓰고 저장하지 않음) · 인증 불필요 · 응답은 캐시.
 */

import hanjaData from "../../../data-pipeline/hanja/hanja.json";

export const runtime = "nodejs";

type HanjaEntry = { strokes: number; radical: number; element: string; sound: string };
type Candidate = { c: string; strokes: number; element: string };

const DB = hanjaData as Record<string, HanjaEntry>;

// 음절 → 한자 후보 역색인 (모듈 로드 시 1회 구축, 획수 오름차순)
let BY_SOUND: Map<string, Candidate[]> | null = null;
function bySound(): Map<string, Candidate[]> {
  if (BY_SOUND) return BY_SOUND;
  const m = new Map<string, Candidate[]>();
  for (const [c, e] of Object.entries(DB)) {
    if (!e.sound) continue;
    // BMP 밖 확장한자(𢓭 등)는 모바일에서 □로 깨지기 쉬워 후보에서 제외
    if ((c.codePointAt(0) ?? 0) > 0xffff) continue;
    const arr = m.get(e.sound);
    const item = { c, strokes: e.strokes, element: e.element };
    if (arr) arr.push(item);
    else m.set(e.sound, [item]);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.strokes - b.strokes);
  BY_SOUND = m;
  return m;
}

const isHangulSyllable = (ch: string) => /^[가-힣]$/.test(ch);

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.trim() ?? "";
  // 이름만(성 제외) 기준 — 과도한 요청 방지로 최대 4음절
  const syllables = [...new Set([...name].filter(isHangulSyllable))].slice(0, 4);

  const idx = bySound();
  const candidates: Record<string, Candidate[]> = {};
  for (const s of syllables) candidates[s] = idx.get(s) ?? [];

  return Response.json(
    { candidates },
    { headers: { "cache-control": "public, max-age=86400, s-maxage=86400" } }
  );
}
