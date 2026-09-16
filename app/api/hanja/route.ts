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

type HanjaEntry = { strokes: number; radical: number; element: string; sound: string; hun?: string };
/** hun: 한국 전통 훈(뜻). 같은 음의 후보가 수십 개라 이게 없으면 고를 수가 없다
 *  — "높을 준(峻)"인지 "술그릇 준(樽)"인지는 훈이라야 갈린다.
 *  8,525자 중 923자는 훈을 확인하지 못해 ""로 내려간다(희귀자·이두자).
 *  폼이 기본 목록에서는 숨기고, 사용자가 원할 때만 펼쳐 보여 준다. */
type Candidate = { c: string; strokes: number; element: string; hun: string };

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
    // 훈이 없는 글자(923자)도 내려보낸다. hun이 빈 문자열로 온다.
    //
    // 처음에는 아예 걸러 냈다 — 뜻을 못 보여주면 고를 수 없어 목록만 길어지니까.
    // 그런데 폰에서는 한자를 직접 타이핑할 방법이 사실상 없다(웹 입력창에서는
    // 한글 키보드의 한자 변환이 동작하지 않는다). 그래서 걸러 내면 그 글자를
    // 쓰려는 사람에게 남는 수단이 없어진다.
    // 부모는 가족관계증명서 등에서 본 글자를 **눈으로 알아본다** — 기본 목록에서는
    // 숨기되, 폼에서 "뜻 미상 한자도 보기"를 켜면 찾아 고를 수 있게 한다.
    const arr = m.get(e.sound);
    const item = { c, strokes: e.strokes, element: e.element, hun: e.hun ?? "" };
    if (arr) arr.push(item);
    else m.set(e.sound, [item]);
  }
  // 훈이 있는 글자를 앞에, 그 안에서 획수 오름차순.
  // 뜻 미상 글자가 목록 앞을 차지하면 고르기 어려워진다.
  for (const arr of m.values()) {
    arr.sort((a, b) => {
      if (!!a.hun !== !!b.hun) return a.hun ? -1 : 1;
      return a.strokes - b.strokes;
    });
  }
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
