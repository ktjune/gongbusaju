/**
 * scripts/threads-cases.ts — 스레드 콘텐츠용 가상 사례 사주 계산
 *
 * 실행: npx tsx scripts/threads-cases.ts
 *
 * ⚠️ 여기 쓰는 생년월일시는 **전부 가상**이어야 한다.
 * 실제 고객 주문의 생년월일시는 그 자체로 개인정보이고, 이름을 빼도
 * 본인이 보면 알아본다. 공개 콘텐츠 소재로 절대 쓰지 않는다.
 *
 * LLM은 부르지 않는다 — 사주 계산은 결정적이고 무료다. 산문은 사람이 쓴다.
 */
import { computeSaju, wuxingToHangul, tenGodToHangul, ganjiToHangul } from "../lib/saju";

const CASES = [
  { label: "2016-05-14 09:20 남아", y: 2016, m: 5, d: 14, h: 9, mi: 20, g: "male" as const },
  { label: "2014-12-03 21:40 여아", y: 2014, m: 12, d: 3, h: 21, mi: 40, g: "female" as const },
  { label: "2018-03-22 07:10 여아", y: 2018, m: 3, d: 22, h: 7, mi: 10, g: "female" as const },
  { label: "2015-08-08 14:00 남아", y: 2015, m: 8, d: 8, h: 14, mi: 0, g: "male" as const },
  { label: "2017-11-27 05:30 남아", y: 2017, m: 11, d: 27, h: 5, mi: 30, g: "male" as const },
];

for (const c of CASES) {
  const s = computeSaju({
    birthYear: c.y, birthMonth: c.m, birthDay: c.d,
    birthHour: c.h, birthMinute: c.mi, gender: c.g,
  });

  const elements = Object.entries(s.elements)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${wuxingToHangul(k as never)} ${Math.round(v)}%`)
    .join("  ");

  const tenGods = Object.entries(s.tenGods)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${tenGodToHangul(k as never)}(${v})`)
    .join("  ");

  console.log(`\n━━━ ${c.label} ━━━`);
  console.log(`원국   ${ganjiToHangul(s.pillars.year)} / ${ganjiToHangul(s.pillars.month)} / ${ganjiToHangul(s.pillars.day)} / ${s.pillars.hour ? ganjiToHangul(s.pillars.hour) : "(시간 모름)"}`);
  console.log(`일간   ${s.pillars.day.charAt(0)}`);
  console.log(`오행   ${elements}`);
  console.log(`십성   ${tenGods || "(없음)"}`);
  console.log(`기질   ${Object.entries(s.traitScores).map(([k, v]) => `${k} ${v}`).join("  ")}`);
}
