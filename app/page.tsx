import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main>
      {/* ── 네비 ── */}
      <nav className={styles.nav}>
        <div className={styles.brand}>공부사주</div>
        <Link href="/apply" className={styles.navCta}>
          리포트 신청
        </Link>
      </nav>

      {/* ── 히어로 ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true">
          <span>木</span><span>火</span><span>土</span>
          <span>金</span><span>水</span><span>天</span>
          <span>地</span><span>人</span>
        </div>
        <div className={styles.heroInner}>
          <div className={styles.badge}>공부·기질 사주 리포트</div>
          <h1 className={styles.heroTitle}>
            우리 아이의<br />
            타고난 <span className={styles.accent}>공부 결</span>을 읽다
          </h1>
          <p className={styles.heroSub}>
            생년월일시로 풀어낸 공부 기질·성장 흐름.<br />
            사주 해석과 공공데이터를 분리해, 단정이 아닌 <b>참고</b>로 전합니다.
          </p>
          <div className={styles.heroBtns}>
            <Link href="/apply" className={styles.btnPrimary}>
              리포트 신청하기
            </Link>
            <a href="#inside" className={styles.btnGhost}>
              무엇이 담기나요?
            </a>
          </div>
          <p className={styles.heroNote}>
            전문 검수 후 웹·PDF로 전달 · 카카오/이메일 알림
          </p>
        </div>
      </section>

      {/* ── 공감 섹션 ── */}
      <div className={styles.painBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>이런 고민, 있으신가요?</h2>
          <p className={styles.sectionLead}>많은 부모님들이 이 질문에서 출발했습니다</p>
          <div className={styles.pains}>
            <div className={styles.painCard}>
              <div className={styles.painIcon}>😮‍💨</div>
              <p>&ldquo;학원을 여러 개 보내는데 왜 성적이 안 오르지?&rdquo;</p>
            </div>
            <div className={styles.painCard}>
              <div className={styles.painIcon}>🤔</div>
              <p>&ldquo;우리 아이, 도대체 어떤 방식으로 배울 때 집중할까?&rdquo;</p>
            </div>
            <div className={styles.painCard}>
              <div className={styles.painIcon}>😟</div>
              <p>&ldquo;중학교·고등학교가 달라지는데 뭘 준비해야 하지?&rdquo;</p>
            </div>
          </div>
          <p className={styles.painAnswer}>
            공부사주는 아이의 <b>타고난 기질과 흐름</b>을 사주 명리로 읽고,<br />
            학교 공공데이터와 나란히 놓아 <b>참고 지도</b>를 그려드립니다.
          </p>
        </section>
      </div>

      {/* ── 작동 방식 ── */}
      <div className={styles.sectionBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>신청부터 전달까지</h2>
          <p className={styles.sectionLead}>즉석 출력이 아닌, 검수를 거친 한 부의 리포트</p>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div className={styles.stepName}>정보 입력</div>
              <div className={styles.stepDesc}>
                자녀의 생년월일시·성별<br />(주소·재학 학교는 선택)
              </div>
            </div>
            <div className={styles.stepArrow} aria-hidden="true">→</div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div className={styles.stepName}>계산 · 검수</div>
              <div className={styles.stepDesc}>
                만세력 계산과 해석을<br />전문 검수로 한 번 더 거릅니다
              </div>
            </div>
            <div className={styles.stepArrow} aria-hidden="true">→</div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div className={styles.stepName}>전달</div>
              <div className={styles.stepDesc}>
                웹 결과 페이지와 PDF<br />완성 시 알림으로 안내
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── 리포트 구성 ── */}
      <section className={styles.section} id="inside">
        <h2 className={styles.sectionTitle}>리포트에 담기는 것</h2>
        <p className={styles.sectionLead}>사주 해석(참고)과 학교 사실(공공데이터)을 나란히</p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🧭</div>
            <div className={styles.featureName}>타고난 결 · 일간</div>
            <div className={styles.featureDesc}>아이를 나타내는 일간으로 본 본질과 기질</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🌱</div>
            <div className={styles.featureName}>오행 · 십성</div>
            <div className={styles.featureDesc}>강한 기운과 보완할 기운, 마음의 습관</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📚</div>
            <div className={styles.featureName}>공부 스타일</div>
            <div className={styles.featureDesc}>잘 맞는 학습 방식·환경과 부모 코칭 포인트</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📈</div>
            <div className={styles.featureName}>대운 · 세운</div>
            <div className={styles.featureDesc}>학령기 흐름과 다가오는 해의 참고 포인트</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎒</div>
            <div className={styles.featureName}>지금 우리 아이</div>
            <div className={styles.featureDesc}>현 학령 단계에 맞춘 안내와 진학 타임라인</div>
          </div>
          <div className={`${styles.feature} ${styles.featurePremium}`}>
            <div className={styles.featurePremiumBadge}>주소 입력 시</div>
            <div className={styles.featureIcon}>🏫</div>
            <div className={styles.featureName}>학교 정보</div>
            <div className={styles.featureDesc}>예상 배정 학교·반경 학교군 (교육청 확인 필요)</div>
          </div>
        </div>
      </section>

      {/* ── 리포트 미리보기 카드 ── */}
      <div className={styles.previewBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>이렇게 만들어집니다</h2>
          <p className={styles.sectionLead}>실제 리포트의 일부를 살펴보세요</p>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>공부사주 리포트 — 甲木 일간 (예시)</div>
              <div className={styles.previewTier}>예시</div>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>🧭 타고난 결</div>
                <p className={styles.previewText}>
                  甲木 일간은 곧고 위로 자라는 큰 나무의 기운입니다. 목표를 향해 꾸준히 나아가는 힘이 강하고,
                  자신만의 원칙과 페이스를 지키며 배울 때 가장 잘 흡수합니다…
                </p>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>📚 공부 스타일</div>
                <p className={styles.previewText}>
                  시간 압박보다 충분한 이해를 선호합니다. 개념을 먼저 큰 그림으로 잡고 세부를 채우는 방식이 맞으며…
                </p>
              </div>
              <div className={styles.previewBlur}>
                <div className={styles.previewBlurText}>검수 완료 후 전체 내용이 전달됩니다</div>
              </div>
            </div>
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
              <div className={styles.tierName}>공부사주 리포트</div>
              <div className={styles.tierPrice}>
                29,000<span>원</span>
              </div>
              <ul className={styles.tierList}>
                <li>사주 원국·오행·십성 해석</li>
                <li>공부 스타일·부모 코칭</li>
                <li>대운·세운 흐름 · 학령 단계 맞춤 안내</li>
                <li>예상 배정 학교·반경 학교군 <b>(주소 입력 시)</b></li>
                <li>웹 결과 페이지 + PDF</li>
              </ul>
              <Link href="/apply" className={styles.tierBtn}>
                리포트 신청
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ── 후기 ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>리포트를 받아보신 분들의 이야기</h2>
        <p className={styles.sectionLead}>단정이 아닌 참고로 건넨 이야기들</p>
        <div className={styles.reviews}>
          <div className={styles.review}>
            <p className={styles.reviewText}>
              &ldquo;아이를 설명하는 단어들이 낯설지 않았어요. 이미 알고 있었지만 말로 정리가 안 됐던 것들이
              글로 적혀 있으니 오히려 더 잘 보이더라고요.&rdquo;
            </p>
            <div className={styles.reviewer}>초2 딸 엄마 · 서울</div>
          </div>
          <div className={styles.review}>
            <p className={styles.reviewText}>
              &ldquo;학교 배정 정보는 교육청에 확인해야 한다는 안내가 있어서 오히려 신뢰가 갔어요.
              과하게 단정하지 않는 게 이 서비스의 차이인 것 같습니다.&rdquo;
            </p>
            <div className={styles.reviewer}>초5 아들 아빠 · 경기</div>
          </div>
          <div className={styles.review}>
            <p className={styles.reviewText}>
              &ldquo;대운 흐름을 보면서 올해가 왜 이렇게 아이가 예민한지 이해가 됐어요.
              판단이 아닌 참고라는 전제가 있어서 편하게 읽을 수 있었습니다.&rdquo;
            </p>
            <div className={styles.reviewer}>중1 자녀 엄마 · 부산</div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <div className={styles.sectionBand}>
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
              <summary className={styles.faqQ}>학교 배정 정보는 얼마나 정확한가요?</summary>
              <p className={styles.faqA}>
                공공데이터 기반의 예상 배정으로, 실제 배정은 교육청에 최종 확인이 필요합니다.
                리포트에는 항상 &ldquo;예상 배정 (교육청 확인 필요)&rdquo;로 명시하며, 출처와 기준일을 함께 표기합니다.
              </p>
            </details>
            <details className={styles.faq}>
              <summary className={styles.faqQ}>리포트는 얼마나 걸려 오나요?</summary>
              <p className={styles.faqA}>
                신청 후 전문 검수를 거쳐 전달합니다. 목표 납기는 영업일 기준 1~2일이며,
                완성되면 입력하신 이메일·카카오로 결과 링크를 보내드립니다.
              </p>
            </details>
            <details className={styles.faq}>
              <summary className={styles.faqQ}>아이 개인정보는 어떻게 관리되나요?</summary>
              <p className={styles.faqA}>
                생년월일시·주소·학교는 암호화·분리 저장됩니다. 법정대리인 동의 하에 수집되며,
                리포트 제작·보관기간(12개월) 이후 파기됩니다.
              </p>
            </details>
          </div>
        </section>
      </div>

      {/* ── 하단 CTA ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>우리 아이의 공부 결,<br />지금 읽어보세요</h2>
          <p className={styles.ctaSub}>검수를 거친 한 부의 리포트 · 29,000원부터</p>
          <Link href="/apply" className={styles.ctaBtn}>
            리포트 신청하기
          </Link>
        </div>
      </section>

      {/* ── 신뢰/면책 ── */}
      <section className={styles.trust}>
        <p className={styles.trustQuote}>
          &ldquo;사주는 아이를 이해하는 하나의 렌즈입니다.<br />
          정답이 아니라, 함께 보는 참고자료입니다.&rdquo;
        </p>
        <p className={styles.trustText}>
          본 리포트의 기질·대운 해석은 사주 명리의 관점이며 실측 검사 결과가 아닙니다.
          학교 정보는 공공데이터 기반 예상 배정으로, 실제 배정은 교육청에 확인이 필요합니다.
          아이의 실제 모습과 보호자의 판단이 항상 우선합니다.
        </p>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>공부사주</div>
        <div>공부·기질 사주 리포트 서비스</div>
        <div className={styles.footerLinks}>
          <Link href="/apply">리포트 신청</Link>
          <span>·</span>
          <Link href="/terms">이용약관</Link>
          <span>·</span>
          <Link href="/privacy">개인정보처리방침</Link>
          <span>·</span>
          <a href="mailto:ktjune0514@gmail.com">문의</a>
        </div>
        <div className={styles.footerNote}>
          미성년 자녀 정보는 법정대리인 동의 하에 암호화·분리 저장됩니다.
        </div>
      </footer>
    </main>
  );
}
