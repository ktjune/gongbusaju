/**
 * /case — 광고 유입 전용 랜딩.
 *
 * 메인(`app/page.tsx`)은 여러 경로의 유입을 다 받아야 해서 "서비스 소개"로 시작한다.
 * 반면 광고를 보고 온 사람은 "봤더니 이렇더라"는 이야기를 기대하고 들어온다.
 * 그 약속에 맞춰 **사례부터** 보여주는 페이지를 따로 둔다.
 *
 * ⚠️ 여기 실린 사례의 생년월일시는 **가상**이다. 실제 주문의 생년월일시는 그 자체로
 * 개인정보이고 이름을 빼도 본인이 알아보므로 공개 콘텐츠에 절대 쓰지 않는다.
 * 사주 수치는 `scripts/threads-cases.ts`로 실제 계산한 값이라 지어낸 숫자가 아니다.
 *
 * 검색에는 노출하지 않는다(noindex) — 메인과 내용이 겹쳐 서로 잡아먹는다.
 * `app/sitemap.ts`의 ROUTES는 고정 목록이라 이 경로는 자동으로 들어가지 않는다.
 *
 * 메인을 건드리지 않기 위해 공통 마크업(네비·맛보기·가격·푸터)은 공통화하지 않고
 * 복사해 쓴다 — `redesign/ink-and-paper` 브랜치가 `app/page.tsx`를 전면 재작성 중이라
 * 지금 컴포넌트로 추출하면 그 작업과 충돌한다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";
import { REPORT_PRICE_LABEL } from "@/lib/pricing";
import styles from "../../home.module.css";
import s from "./case.module.css";

export const metadata: Metadata = {
  title: "놀 땐 세 시간, 문제집은 10분 — 공부결",
  description:
    "여덟 살 아이의 공부 결을 사주로 풀어본 예시입니다. 집중을 못 하는 아이가 아니라, 집중이 붙는 자리가 다른 아이였습니다.",
  robots: { index: false, follow: false },
};

/** 기질 수치 — scripts/threads-cases.ts 실행 결과(2018-03-22 07:10 여아, 가상) */
const TRAITS: [string, number][] = [
  ["창의력", 88],
  ["집중력", 58],
  ["리더십", 52],
  ["사교성", 45],
  ["직관력", 44],
  ["분석력", 35],
];

export default function CasePage() {
  return (
    <main>
      {/* ── 네비 ── */}
      <nav className={styles.nav}>
        {/* 브랜드는 "공부결" — "공부사주"는 설명 문구에서만 사용 */}
        <div className={styles.brand}>
          공부결
          <span className={styles.brandTag}>우리 아이 공부의 결</span>
        </div>
        <Link href="/apply" className={styles.navCta}>
          리포트 신청
        </Link>
      </nav>

      {/* ── 사례 히어로 : 스크롤 없이 여기서 이야기가 시작된다 ── */}
      <section className={s.caseHero}>
        <div className={s.caseHeroInner}>
          <div className={s.caseKicker}>리포트 예시 · 여덟 살 여자아이</div>
          <h1 className={s.caseHeadline}>
            놀 땐 세 시간,
            <br />
            문제집은 10분인 아이
          </h1>
          <p className={s.caseLede}>
            &ldquo;우리 애는 집중력이 없어요&rdquo;라는 말을 자주 듣던 아이였습니다.
            <br />
            사주로 공부 결을 풀어보니, 집중력이 없는 게 아니었습니다.
          </p>
        </div>
      </section>

      {/* ── 사례 본문 ── */}
      <div className={s.caseBody}>
        <div className={s.caseStep}>
          <div className={s.caseStepLabel}>01 · 어떤 아이였나</div>
          <h2 className={s.caseStepTitle}>같은 아이인데 시간이 다르게 흐릅니다</h2>
          <p className={s.caseText}>
            그림을 그리거나 뭘 만들 때는 두세 시간도 앉아 있습니다. 부르는 소리도 못 듣고요.
            그런데 학습지를 펴면 10분을 못 넘깁니다. 연필을 굴리고, 창밖을 보고, 갑자기
            딴 이야기를 꺼냅니다.
          </p>
          <p className={s.caseQuote}>&ldquo;몇 번을 말해야 알아들어?&rdquo;</p>
          <p className={s.caseText}>
            이런 아이에게 가장 많이 하는 말이자, 가장 안 통하는 말입니다.
          </p>
        </div>

        <div className={s.caseStep}>
          <div className={s.caseStepLabel}>02 · 사주로 보면</div>
          <h2 className={s.caseStepTitle}>내보내는 기운이 넷, 정리하는 기운이 없습니다</h2>

          <div className={s.chart}>
            <div className={s.chartRow}>
              <span className={s.chartKey}>원국</span>
              <span className={s.chartVal}>무술 · 을묘 · 계축 · 을묘</span>
            </div>
            <div className={s.chartRow}>
              <span className={s.chartKey}>일간</span>
              <span className={s.chartVal}>癸(계) — 스며들듯 흐르는 물</span>
            </div>
            <div className={s.chartRow}>
              <span className={s.chartKey}>오행</span>
              <span className={s.chartVal}>목 50% · 토 38% · 수 13% · 화 0% · 금 0%</span>
            </div>
            <div className={s.chartRow}>
              <span className={s.chartKey}>십성</span>
              <span className={s.chartVal}>식신 4 · 정관 2 · 칠살 1</span>
            </div>
          </div>

          <div className={s.bars}>
            {TRAITS.map(([name, v]) => {
              const high = v >= 70;
              return (
                <div className={s.bar} key={name}>
                  <span className={s.barName}>{name}</span>
                  <span className={s.barTrack}>
                    <span
                      className={`${s.barFill} ${high ? s.barFillHigh : ""}`}
                      style={{ width: `${v}%` }}
                    />
                  </span>
                  <span className={`${s.barVal} ${high ? s.barValHigh : ""}`}>{v}</span>
                </div>
              );
            })}
          </div>

          <p className={s.caseText}>
            <b>식신(食神)</b>은 안에서 떠오른 것을 밖으로 내보내는 기운입니다. 이 아이는 그게
            넷입니다. 반대로 틀에 맞춰 정리하고 다듬는 기운(金)은 <b>0%</b>입니다.
          </p>
          <p className={s.caseText}>
            창의력 88, 분석력 35. 이 간격이 교실에서는 &ldquo;딴생각이 많은 아이&rdquo;로 보입니다.
            하지만 결을 놓고 보면 <b>집중을 못 하는 게 아니라, 집중이 &lsquo;내보내는 일&rsquo;에만
            붙는 아이</b>로 읽을 수 있습니다.
          </p>
        </div>

        <div className={s.caseStep}>
          <div className={s.caseStepLabel}>03 · 그래서 무엇을 해볼 수 있나</div>
          <h2 className={s.caseStepTitle}>없는 걸 만들기보다, 붙는 자리를 옮겨줍니다</h2>
          <ul className={s.tryList}>
            <li>
              문제를 풀리기 전에 먼저 말하게 둡니다 —{" "}
              <b>&ldquo;오늘 배운 거 나한테 설명해줄래?&rdquo;</b> 내보내고 나면 다음 것이 들어갈
              자리가 생깁니다.
            </li>
            <li>
              답을 쓰기 전에 소리 내어 말해보게 합니다. 쓰는 건 정리하는 일이라 이 아이에게
              가장 나중에 오는 순서입니다.
            </li>
            <li>
              분량을 정해주기보다 <b>끝난 것이 눈에 보이게</b> 해줍니다. 스스로 끊는 건 어려워도,
              정해진 걸 따르는 건 잘합니다.
            </li>
          </ul>
          <p className={s.caseText} style={{ marginTop: 18 }}>
            맞고 틀리고를 가리는 이야기가 아닙니다. 아이를 다르게 불러볼 수 있는 말 하나를
            갖는 일에 가깝습니다.
          </p>
        </div>
      </div>

      <p className={s.exampleNote}>
        ※ 위 사례의 생년월일시는 실제 이용자의 것이 아닌 <b>가상의 예시</b>이며, 사주 수치는
        동일한 엔진으로 계산한 값입니다. 아이마다 결과는 다르게 나옵니다.
      </p>

      {/* ── 다리 : 사례 → 상품 ── */}
      <div className={s.bridge}>
        <div className={s.bridgeInner}>
          <p className={s.bridgeText}>
            아이마다 결이 다릅니다.
            <br />
            <b>우리 아이 것은 생년월일시로 따로 나옵니다.</b>
          </p>
        </div>
      </div>

      {/* ── 맛보기 리포트 ── */}
      <div className={styles.previewBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>실제로 받는 리포트</h2>
          <p className={styles.sectionLead}>
            아래는 다른 아이의 리포트 일부입니다 — 전체는 버튼에서 열어볼 수 있어요
          </p>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>공부결 리포트 — 壬水 일간 · 준서 (예시)</div>
              <div className={styles.previewTier}>예시</div>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewImagery}>
                <div className={styles.previewImageryForm}>
                  &ldquo;온갖 물길이 큰 바다로 모여드는 형상(百川歸海)&rdquo;
                </div>
                <div className={styles.previewImageryReading}>
                  무엇이든 담아 깊고 넓게 흐르는 강물의 기상 — 포용력과 깊은 사고력을 품은 아이
                </div>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>🧭 타고난 결 · 일간</div>
                <p className={styles.previewText}>
                  일간은 壬(임), 깊고 넓게 흐르는 큰 물입니다. 겉은 잔잔해도 속으로 많은 생각을
                  굴리며, 새로운 지식을 자기 속도로 소화해 자기 것으로 만드는 힘이 있습니다…
                </p>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>🌱 오행 · 강점과 보완</div>
                <p className={styles.previewText}>
                  金(금) 38%로 정리·분별의 힘이 도드라지고, 火(화)는 옅어 표현·발산은 앞으로 채워 갈
                  여백입니다. 노래·율동·바깥 놀이로 균형을 참고해 볼 수 있어요…
                </p>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>✍️ 이름 · 성명학</div>
                <p className={styles.previewText}>
                  이름의 소리는 강점 金을 밀어주고, 한자(俊書)는 부족한 火를 채워 줍니다 — 한 이름이
                  두 방향으로 아이를 돕는 셈…
                </p>
              </div>
              <div className={styles.previewBlur}>
                <div className={styles.previewBlurText}>
                  오행·십성·공부 스타일·진로·대운·세운 등 22개 섹션
                </div>
              </div>
            </div>
          </div>
          <div className={styles.previewCtaWrap}>
            <a
              href="/sample"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.previewCta}
            >
              실제 리포트 전체 예시 보기 →
            </a>
          </div>
        </section>
      </div>

      {/* ── 가격 ── */}
      <div className={styles.sectionBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>가격</h2>
          <p className={styles.sectionLead}>아이 한 명, 한 부의 리포트</p>
          <div className={styles.tiers}>
            <div className={`${styles.tier} ${styles.tierFeatured}`}>
              <div className={styles.tierName}>공부결 리포트</div>
              <div className={styles.tierOriginal}>
                정가 <s>29,000원</s>
              </div>
              <div className={styles.tierPrice}>
                <span className={styles.tierBadge}>66% 할인</span>
                {REPORT_PRICE_LABEL}
                <span>원</span>
              </div>
              <ul className={styles.tierList}>
                <li>사주 원국·오행·십성 해석</li>
                <li>공부 스타일·부모 코칭</li>
                <li>대운·세운 흐름 · 학령 단계 맞춤 안내</li>
                <li>
                  이름 성명학 풀이 <b>(이름·한자 입력 시)</b>
                </li>
                <li>
                  예상 배정 학교·반경 학교군 <b>(주소 입력 시)</b>
                </li>
                <li>웹 결과 페이지 + PDF</li>
              </ul>
              <Link href="/apply" className={styles.tierBtn}>
                리포트 신청
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ── FAQ : 결제 직전에 걸리는 것만 추렸다 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>자주 묻는 질문</h2>
        <div className={styles.faqs}>
          <details className={styles.faq}>
            <summary className={styles.faqQ}>사주를 믿지 않아도 의미가 있나요?</summary>
            <p className={styles.faqA}>
              믿음과 관계없이, 리포트는 아이를 새로운 시선으로 바라보는 하나의 언어입니다.
              기질을 묘사하는 방식이 낯설지 않다면, 그것만으로 충분히 활용할 수 있습니다.
            </p>
          </details>
          <details className={styles.faq}>
            <summary className={styles.faqQ}>출생 시각을 모를 때도 신청할 수 있나요?</summary>
            <p className={styles.faqA}>
              가능합니다. 시각을 모름으로 체크하면 시주(時柱)를 제외하고 나머지 사주로 풀이합니다.
              일주·월주·년주 기반의 기질 해석은 충분히 의미 있는 내용을 담고 있습니다.
            </p>
          </details>
          <details className={styles.faq}>
            <summary className={styles.faqQ}>리포트는 얼마나 걸려 오나요?</summary>
            <p className={styles.faqA}>
              <b>결제 완료 후 1일(24시간) 이내</b>에 이용하실 수 있습니다. 대부분은 신청 후 수 분
              내에 자동 검수를 통과해 바로 발송됩니다.
            </p>
          </details>
          <details className={styles.faq}>
            <summary className={styles.faqQ}>아이 개인정보는 어떻게 관리되나요?</summary>
            <p className={styles.faqA}>
              생년월일시·주소·학교는 암호화·분리 저장됩니다. 법정대리인 동의 하에 수집되며,
              리포트 제작·보관기간(6개월) 이후 파기됩니다.
            </p>
          </details>
          <details className={styles.faq}>
            <summary className={styles.faqQ}>마음에 들지 않으면 환불되나요?</summary>
            <p className={styles.faqA}>
              리포트 열람 전이라면 결제일로부터 7일 이내 취소·환불이 가능합니다. 리포트에 하자가
              있는 경우에는 그 사실을 안 날부터 30일 이내(공급받은 날부터 3개월 이내) 신청하실 수
              있습니다. <Link href="/refund">취소·환불 안내</Link>에서 바로 접수됩니다.
            </p>
          </details>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            우리 아이의 공부 결,
            <br />
            지금 읽어보세요
          </h2>
          <p className={styles.ctaSub}>
            검수를 거친 한 부의 리포트 · 지금 {REPORT_PRICE_LABEL}원
          </p>
          <Link href="/apply" className={styles.ctaBtn}>
            리포트 신청하기
          </Link>
        </div>
      </section>

      {/* ── 신뢰/면책 ── */}
      <section className={styles.trust}>
        <p className={styles.trustQuote}>
          &ldquo;사주는 아이를 이해하는 하나의 렌즈입니다.
          <br />
          정답이 아니라, 함께 보는 참고자료입니다.&rdquo;
        </p>
        <p className={styles.trustText}>
          본 리포트의 기질·대운 해석은 사주 명리의 관점이며 실측 검사 결과가 아닙니다. 학교 정보는
          공공데이터 기반 예상 배정으로, 실제 배정은 교육청에 확인이 필요합니다. 아이의 실제 모습과
          보호자의 판단이 항상 우선합니다.
        </p>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>공부결</div>
        <div>우리 아이 공부의 결 · 공부사주 리포트 서비스</div>
        <div className={styles.footerLinks}>
          <Link href="/">홈</Link>
          <span>·</span>
          <Link href="/apply">리포트 신청</Link>
          <span>·</span>
          <Link href="/terms">이용약관</Link>
          <span>·</span>
          <Link href="/privacy">개인정보처리방침</Link>
          <span>·</span>
          {/* PG 심사 요건 — 취소·환불 창구가 사이트에서 바로 보여야 한다 */}
          <Link href="/refund">취소 · 환불</Link>
          <span>·</span>
          <a href={`mailto:${SUPPORT_EMAIL}`}>문의</a>
        </div>
        {/* PG 입점 심사 요건 — 사업자정보는 사업자등록증과 완전히 일치해야 함 */}
        <div className={styles.footerBiz}>
          상호: 문도어 · 대표자: 권태준 · 사업자등록번호: 732-46-01157
          <br />
          통신판매업신고번호: 제2026-서울동대문-0436호
          <br />
          사업장 주소: 서울특별시 동대문구 답십리로68길 31, 3층 s46호
          <br />
          전화번호: 0502-1944-3249 · 고객문의: {SUPPORT_EMAIL}
        </div>
        <div className={styles.footerNote}>
          미성년 자녀 정보는 법정대리인 동의 하에 암호화·분리 저장됩니다.
        </div>
      </footer>
    </main>
  );
}
