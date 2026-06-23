/**
 * lib/report/demo.ts
 * 데모용 LLM 목업 — ANTHROPIC_API_KEY 없을 때 폴백.
 *
 * 입력 사주(일간·오행 강약·십성)에 맞춰 결정론적으로 산문 11종을 조합한다.
 * guardrails를 통과하는 안전 문구만 사용한다. 실제 서비스 품질은 Claude API 몫이며,
 * 이 목업으로 만든 리포트는 결과페이지에 "데모 자동 생성"으로 표기한다.
 */

import type { SajuResult } from "../saju";
import { wuxingToHangul, tenGodWithHangul } from "../saju";
import { STEM_DICT, WUXING_DICT, TENGOD_DICT, TENGOD_KEY_ALIAS, CAREER_MAP, MAJOR_MAP } from "./content";
import type { LlmProvider } from "./generate";

type Ranked = { hanja: string; key: keyof SajuResult["elements"]; pct: number };

function rankElements(saju: SajuResult): Ranked[] {
  const order: Array<[string, keyof SajuResult["elements"]]> = [
    ["木", "목"], ["火", "화"], ["土", "토"], ["金", "금"], ["水", "수"],
  ];
  return order
    .map(([hanja, key]) => ({ hanja, key, pct: Math.round(saju.elements[key]) }))
    .sort((a, b) => b.pct - a.pct);
}

function topTenGods(saju: SajuResult): Array<[string, number]> {
  return Object.entries(saju.tenGods)
    .map(([k, v]) => [TENGOD_KEY_ALIAS[k] ?? k, v] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** 데모 산문 11종 생성 — 입력 사주 데이터를 문장에 녹인다 */
export function buildDemoProse(saju: SajuResult): Record<string, string> {
  const dayStem = saju.pillars.day.charAt(0);
  const stem = STEM_DICT[dayStem];
  const ranked = rankElements(saju);
  const strong = ranked[0];
  const weak = ranked[ranked.length - 1];
  const strongInfo = WUXING_DICT[strong.hanja];
  const weakInfo = WUXING_DICT[weak.hanja];
  const gods = topTenGods(saju);
  const topGod = gods[0];
  const topGodInfo = topGod ? TENGOD_DICT[topGod[0]] : null;

  const D = "(※ 아래는 데모 자동 생성 문구입니다. 실제 서비스는 전문 해석가가 검수한 맞춤 풀이를 제공합니다.)";

  return {
    dayMasterProse:
      `이 아이의 일간(日干), 즉 사주에서 아이 자신을 뜻하는 글자는 ${dayStem}(${stem?.hangul ?? ""})입니다. ` +
      `${stem?.nature ?? ""}에 비유되며, ${stem?.desc ?? "타고난 고유한 결을 지닌 것으로 풀이됩니다."}\n\n` +
      `일간은 모든 해석의 기준점입니다. 아이를 이해할 때 "어떤 결을 타고났는가"의 출발점으로 참고해 주세요. ${D}`,

    elementsProse:
      `오행 분포를 보면 ${strong.hanja}(${wuxingToHangul(strong.hanja)}) 기운이 ${strong.pct}%로 가장 두드러집니다. ` +
      `${strongInfo?.study ?? ""} ${strongInfo?.strong ?? ""}\n\n` +
      `반대로 ${weak.hanja}(${wuxingToHangul(weak.hanja)}) 기운은 ${weak.pct}%로 옅은 편입니다. ${weakInfo?.weak ?? ""}`,

    tenGodsProse: topGodInfo
      ? `십성 구조에서는 ${tenGodWithHangul(topGod[0])}이(가) ${topGod[1]}개로 두드러집니다. ` +
        `${topGodInfo.meaning} ${topGodInfo.study}\n\n` +
        `십성은 일간과 다른 글자의 관계를 읽는 분류로, 마음이 어디로 향하는지를 보여주는 것으로 풀이됩니다.`
      : `십성 분포가 비교적 고른 편으로, 특정 성향에 치우치기보다 균형 잡힌 결로 풀이됩니다.`,

    studyStyleProse:
      `${strongInfo?.keyword ?? "타고난"} 기운이 강한 이 아이는 ${strongInfo?.study ?? "자기만의 방식으로 배우는 경향"}이 있습니다. ` +
      `이 결을 살릴 수 있는 학습 환경과 리듬을 찾아 주는 것이 도움이 되는 것으로 풀이됩니다.\n\n` +
      `반면 ${weak.hanja}(${wuxingToHangul(weak.hanja)}) 기운이 옅으므로, 그 부분을 의식적으로 보완하는 활동을 곁들이면 균형 잡힌 발달에 참고가 됩니다.`,

    studyAreasProse:
      `**집중** 익숙한 환경에서 안정적으로 몰입하는 경향이 있습니다.\n\n` +
      `**암기** 흥미가 붙은 분야에서 기억력이 잘 발휘되는 것으로 풀이됩니다.\n\n` +
      `**이해** 충분한 시간이 주어질 때 원리까지 파고드는 경향이 있습니다.\n\n` +
      `**표현** 준비 시간을 주면 자기 생각을 더 잘 꺼내는 편으로 해석됩니다.\n\n` +
      `**협동** 역할이 분명한 상황에서 힘을 내는 경향이 있습니다.`,

    subjectTendencyProse:
      `${strong.hanja}(${wuxingToHangul(strong.hanja)}) 기운이 강한 점은 전통적으로 위 표의 해당 영역과 잘 닿아 있습니다. ` +
      `그 영역의 활동에서 아이가 흥미를 보이는 지점을 한 걸음 더 깊이 파고들도록 곁에서 북돋아 주세요.`,

    aptitudeProse:
      `이 아이는 **${strongInfo?.keyword ?? "타고난"} 기운이 두드러져, 그와 맞닿은 분야에서 강점이 잘 드러나는 경향**이 있습니다. ` +
      `${strongInfo?.study ?? "자기 결에 맞는 활동에서 몰입이 깊어집니다."}\n\n` +
      `이런 강점은 억지로 다른 틀에 맞추기보다, 아이가 흥미를 보이는 지점을 한 걸음 더 깊이 파고들도록 북돋아 줄 때 가장 잘 자랍니다. ` +
      `옅은 ${weak.hanja}(${wuxingToHangul(weak.hanja)}) 영역은 약점이라기보다 천천히 함께 키워 갈 결로 보아 주세요.`,

    careerProse:
      `기질 관점에서 잘 맞을 수 있는 직업 분야를 참고로 짚어 봅니다.\n\n` +
      ((): string => {
        const m = CAREER_MAP.find((c) => c.element === strong.hanja);
        const fields = m?.fields ?? "다양한 분야";
        return `**${strong.hanja}(${wuxingToHangul(strong.hanja)}) 계열** — ${fields}. ${m?.trait ?? ""}\n\n`;
      })() +
      `진로는 아이의 흥미와 노력 속에서 스스로 넓혀 가는 것이니, 위 분야들을 아이와 대화를 여는 실마리로 삼아 보세요.`,

    majorProse:
      ((): string => {
        const m = MAJOR_MAP.find((x) => x.element === strong.hanja);
        const majors = m?.majors ?? "다양한 전공";
        return `대학 전공·학문 계열로는 **${majors}** 계열이 이 아이의 ${strongInfo?.keyword ?? "타고난"} 기운과 잘 맞는 경향으로 참고됩니다.\n\n`;
      })() +
      `기질로 보면 차분히 깊게 파고드는 환경에서 힘을 내는 편이라, 급격한 변화보다 충분히 탐구할 수 있는 진학 환경이 잘 어울리는 경향입니다. ` +
      `국내 진학과 해외 유학 어느 쪽이든, 관심 전공이 또렷해진 뒤 **그 분야가 강한 국내외 대학을 직접 살펴보시기**를 권합니다.`,

    parentingProse:
      `보호자께서 참고하실 만한 점을 정리합니다.\n\n` +
      `첫째, 아이의 강한 ${strongInfo?.keyword ?? "기질"}을 억누르기보다 살릴 방향을 함께 찾아 주세요.\n\n` +
      `둘째, 결과보다 시도와 과정을 짚어 칭찬해 주세요.\n\n` +
      `셋째, 옅은 ${weak.hanja}(${wuxingToHangul(weak.hanja)}) 기운을 보완하는 활동을 일상에 자연스럽게 곁들여 주세요.`,

    stageProse:
      `지금 단계에서는 아이의 타고난 ${strongInfo?.keyword ?? "결"}을 살리는 작은 성공 경험을 쌓는 것이 ` +
      `이 기질에 잘 맞는 접근으로 풀이됩니다. 새로운 환경에는 적응할 시간을 넉넉히 주는 것이 참고가 됩니다.`,

    eduStagesProse:
      `**초등** — 성적보다 "공부는 매일 하는 것"이라는 습관과, 좋아하는 것을 깊게 파 보는 경험이 중요한 시기입니다. ` +
      `이 아이의 ${strongInfo?.keyword ?? "타고난"} 기운을 살린 활동으로 자신감을 먼저 쌓아 주세요.\n\n` +
      `**중등** — 첫 지필고사와 내신이 시작됩니다. 결과보다 '계획-실행-복기'의 틀을 익히게 돕고, 자유학기 활동을 기질과 연결해 진로를 탐색해 보기 좋은 시기입니다.\n\n` +
      `**고등** — 학습 전략의 비중이 가장 커집니다. 이 아이에게 맞는 공부 방식을 아는 것이 학습량만큼 중요하며, 오래 흥미를 둔 분야를 단서로 진로를 좁혀 가는 것이 참고가 됩니다.`,

    daeunProse:
      `대운(大運)은 10년 단위로 바뀌는 큰 흐름입니다. 각 시기마다 들어오는 기운이 달라지므로, ` +
      `위 타임라인의 시기별 분위기를 참고해 아이의 성장 리듬을 길게 바라보시면 도움이 되는 것으로 풀이됩니다. ${D}`,

    annualProse:
      `다가오는 해들의 세운(그해의 기운)은 위 표와 같습니다. 세운은 그해의 날씨에 비유되며, ` +
      `타고난 사주(원국)라는 큰 틀 위에서 해마다 변주를 주는 것으로 해석됩니다. 큰 변화를 단정하기보다 참고로 활용해 주세요.`,

    schoolConnectionProse:
      `${strongInfo?.keyword ?? "타고난"} 기운이 두드러지는 이 아이의 기질은 그에 맞는 환경에서 더 잘 발현되는 경향이 있습니다. ` +
      `학교 환경을 살피실 때 분위기·규모·프로그램을 한 가지 참고 기준으로 삼아 보실 수 있습니다. ` +
      `다만 어떤 학교가 좋고 나쁘다는 판단이 아니며, 통학 거리·가정 여건 등 여러 요소를 종합해 보호자께서 판단하시기 바랍니다.`,
  };
}

/** 데모 LLM provider — 주어진 사주로 산문을 즉석 생성 (API 불필요) */
export class DemoLlmProvider implements LlmProvider {
  constructor(private readonly saju: SajuResult) {}
  async complete(): Promise<string> {
    return JSON.stringify(buildDemoProse(this.saju));
  }
}
