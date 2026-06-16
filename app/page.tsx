import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main>
      {/* 상단 네비 */}
      <nav className={styles.nav}>
        <div className={styles.brand}>공부사주</div>
        <Link href="/apply" className={styles.navCta}>
          리포트 신청
        </Link>
      </nav>

      {/* 히어로 */}
      <section className={styles.hero}>
        <div className={styles.badge}>공부·기질 사주 리포트</div>
        <h1 className={styles.heroTitle}>
          우리 아이의<br />
          타고난 <span className={styles.accent}>공부 결</span>을 읽다
        </h1>
        <p className={styles.heroSub}>
          생년월일시로 풀어낸 공부 기질·성장 흐름. 사주 해석과 공공데이터를
          분리해, 단정이 아닌 <b>참고</b>로 전합니다.
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
      </section>

      {/* 작동 방식 */}
      <div className={styles.sectionBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>신청부터 전달까지</h2>
          <p className={styles.sectionLead}>
            즉석 출력이 아닌, 검수를 거친 한 부의 리포트
          </p>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div className={styles.stepName}>정보 입력</div>
              <div className={styles.stepDesc}>
                자녀의 생년월일시·성별 (Premium은 주소·재학 학교)
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div className={styles.stepName}>계산 · 검수</div>
              <div className={styles.stepDesc}>
                만세력 계산과 해석을 전문 검수로 한 번 더 거릅니다
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div className={styles.stepName}>전달</div>
              <div className={styles.stepDesc}>
                웹 결과 페이지와 PDF, 완성 시 알림으로 안내
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 리포트 구성 */}
      <section className={styles.section} id="inside">
        <h2 className={styles.sectionTitle}>리포트에 담기는 것</h2>
        <p className={styles.sectionLead}>
          사주 해석(참고)과 학교 사실(공공데이터)을 나란히
        </p>
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🧭</div>
            <div className={styles.featureName}>타고난 결 · 일간</div>
            <div className={styles.featureDesc}>
              아이를 나타내는 일간으로 본 본질과 기질
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🌱</div>
            <div className={styles.featureName}>오행 · 십성</div>
            <div className={styles.featureDesc}>
              강한 기운과 보완할 기운, 마음의 습관
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📚</div>
            <div className={styles.featureName}>공부 스타일</div>
            <div className={styles.featureDesc}>
              잘 맞는 학습 방식·환경과 부모 코칭 포인트
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📈</div>
            <div className={styles.featureName}>대운 · 세운</div>
            <div className={styles.featureDesc}>
              학령기 흐름과 다가오는 해의 참고 포인트
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎒</div>
            <div className={styles.featureName}>지금 우리 아이</div>
            <div className={styles.featureDesc}>
              현 학령 단계에 맞춘 안내와 진학 타임라인
            </div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🏫</div>
            <div className={styles.featureName}>학교 정보 (Premium)</div>
            <div className={styles.featureDesc}>
              예상 배정 학교·반경 학교군 (교육청 확인 필요)
            </div>
          </div>
        </div>
      </section>

      {/* 요금제 */}
      <div className={styles.sectionBand}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>요금제</h2>
          <p className={styles.sectionLead}>아이 한 명, 한 부의 리포트</p>
          <div className={styles.tiers}>
            <div className={styles.tier}>
              <div className={styles.tierName}>Basic</div>
              <div className={styles.tierPrice}>
                29,000<span>원</span>
              </div>
              <ul className={styles.tierList}>
                <li>사주 원국·오행·십성 해석</li>
                <li>공부 스타일·부모 코칭</li>
                <li>대운·세운 흐름</li>
                <li>웹 결과 페이지 + PDF</li>
              </ul>
              <Link href="/apply" className={styles.tierBtnGhost}>
                Basic 신청
              </Link>
            </div>
            <div className={`${styles.tier} ${styles.tierFeatured}`}>
              <div className={styles.tierFlag}>추천</div>
              <div className={styles.tierName}>Premium</div>
              <div className={styles.tierPrice}>
                49,000<span>원</span>
              </div>
              <ul className={styles.tierList}>
                <li>Basic의 모든 내용</li>
                <li>지금 학령 단계 맞춤 안내</li>
                <li>예상 배정 학교·반경 학교군</li>
                <li>학교 선택 기질 참고</li>
              </ul>
              <Link href="/apply" className={styles.tierBtn}>
                Premium 신청
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* 신뢰 · 면책 */}
      <section className={styles.trust}>
        <p className={styles.trustQuote}>
          “사주는 아이를 이해하는 하나의 렌즈입니다. <br />
          정답이 아니라, 함께 보는 참고자료입니다.”
        </p>
        <p className={styles.trustText}>
          본 리포트의 기질·대운 해석은 사주 명리의 관점이며 실측 검사 결과가
          아닙니다. 학교 정보는 공공데이터 기반 예상 배정으로, 실제 배정은
          교육청에 확인이 필요합니다. 아이의 실제 모습과 보호자의 판단이 항상
          우선합니다.
        </p>
      </section>

      {/* 푸터 */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>공부사주</div>
        <div>공부·기질 사주 리포트 서비스</div>
        <div style={{ marginTop: 12, opacity: 0.7 }}>
          미성년 자녀 정보는 법정대리인 동의 하에 암호화·분리 저장됩니다.
        </div>
      </footer>
    </main>
  );
}
