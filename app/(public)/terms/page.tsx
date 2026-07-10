import Link from "next/link";
import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "이용약관 — 공부사주",
  description: "공부사주 서비스 이용약관",
};

const EFFECTIVE_DATE = "2026-06-23";

/**
 * 이용약관 초안 — 약관규제법·전자상거래법 반영.
 * ⚠️ [확인 필요] 표기(사업자 정보 등)는 정식 오픈 전 채워야 함. 변호사 검토 후 사용 권장.
 */
export default function TermsPage() {
  return (
    <div className={styles.page}>
      <main className={styles.sheet}>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.meta}>시행일: {EFFECTIVE_DATE}</p>

        <div className={styles.callout}>
          <b>사업자 정보</b>
          <br />
          상호: 문도어 · 대표자: 권태준 · 사업자등록번호: 732-46-01157
          <br />
          통신판매업신고번호: 제2026-서울동대문-0436호
          <br />
          주소: 서울특별시 동대문구 답십리로68길 31, 3층 s46호
          <br />
          전화번호: 0502-1944-3249
          <br />
          고객문의: moondoor_main@naver.com
        </div>

        <h2 className={styles.h2}>제1조 (목적)</h2>
        <p className={styles.p}>
          본 약관은 공부사주(이하 &ldquo;회사&rdquo;)가 제공하는 사주 기반 공부·진로 리포트 서비스(이하
          &ldquo;서비스&rdquo;)의 이용과 관련하여 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로
          합니다.
        </p>

        <h2 className={styles.h2}>제2조 (정의)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            &ldquo;서비스&rdquo;: 이용자가 입력한 생년월일시 등을 바탕으로 사주 명리 관점의 해석 리포트를
            제작·전달하는 디지털 콘텐츠 서비스.
          </li>
          <li className={styles.li}>
            &ldquo;이용자&rdquo;: 본 약관에 동의하고 서비스를 신청·이용하는 자(보호자 등).
          </li>
          <li className={styles.li}>
            &ldquo;리포트&rdquo;: 회사가 제작하여 웹 및 PDF 형태로 제공하는 해석 결과물.
          </li>
        </ul>

        <h2 className={styles.h2}>제3조 (약관의 효력 및 변경)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</li>
          <li className={styles.li}>
            회사는 관계 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일 및 사유를
            명시하여 적용일 7일 전(이용자에게 불리한 변경은 30일 전)부터 공지합니다.
          </li>
          <li className={styles.li}>
            이용자가 변경 약관에 동의하지 않을 경우 이용계약을 해지할 수 있습니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제4조 (서비스의 내용)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            회사는 사주 명리 관점의 공부 기질·학습 스타일·진로 경향 해석과, (주소 입력 시) 공공데이터 기반
            예상 배정 학교·학교군 정보를 결합한 리포트를 제공합니다.
          </li>
          <li className={styles.li}>
            서비스는 즉시 자동 출력이 아닌, 회사의 검수를 거쳐 전달하는 방식으로 운영될 수 있습니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제5조 (해석의 성격 및 한계)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            리포트의 기질·진로·학습 해석은 <b>사주 명리의 관점에 따른 참고 자료</b>이며, 심리·적성 검사 등
            실측 결과나 미래에 대한 보장·예측이 아닙니다.
          </li>
          <li className={styles.li}>
            학교 배정 정보는 공공데이터에 기반한 <b>예상</b>이며 실제 배정 결과와 다를 수 있습니다. 실제
            배정은 관할 교육청에 확인하셔야 합니다.
          </li>
          <li className={styles.li}>
            이용자는 리포트를 자녀를 이해하는 하나의 참고 자료로 활용해야 하며, 진학·진로 등 중요한 결정은
            이용자 본인의 판단과 책임으로 이루어집니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제6조 (이용계약의 성립 및 요금·결제)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            이용계약은 이용자가 약관 및 개인정보 수집·이용에 동의하고 신청을 완료한 때 성립합니다.
          </li>
          <li className={styles.li}>
            서비스 이용요금은 리포트 1부당 9,900원(정가 29,000원에서 할인)이며, 결제는 토스페이먼츠를 통한 신용·체크카드 및
            간편결제로 이루어집니다. 결제 금액은 신청 화면에 표시됩니다.
          </li>
        </ul>

        <h2 className={styles.h2} id="refund">제7조 (청약철회 및 환불)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            <b>제작 착수 전</b>에는 전액 환불합니다. 회사의 귀책으로 리포트가 제공되지 못한 경우에도
            전액 환불합니다.
          </li>
          <li className={styles.li}>
            본 리포트는 이용자가 입력한 정보로 <b>개별 제작되는 디지털 콘텐츠</b>로서, <b>리포트 제작·제공이
            개시된 후에는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항(제2호·제5호)에 따라
            단순 변심에 의한 청약철회(환불)가 제한</b>됩니다. 회사는 이 사실을 결제 전 화면에 표시하고
            이용자의 동의를 받습니다.
          </li>
          <li className={styles.li}>
            다만 리포트 내용에 <b>명백한 오류·하자</b>가 있거나 표시·광고와 현저히 다른 경우에는, 같은 법
            제17조 제3항에 따라 제공받은 날부터 <b>3개월 이내(그 사실을 안 날 또는 알 수 있었던 날부터 30일
            이내)</b>에 재제작 또는 환불을 요청할 수 있습니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제8조 (이용자의 의무)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            이용자는 정확한 정보를 입력해야 하며, 잘못된 정보로 인한 결과의 부정확성에 대한 책임은
            이용자에게 있습니다.
          </li>
          <li className={styles.li}>
            타인(자녀 포함)의 정보를 입력할 경우, 이용자는 해당 정보를 제공할 정당한 권한(법정대리인 등)을
            보유해야 합니다.
          </li>
          <li className={styles.li}>
            리포트를 무단 복제·재판매·배포하거나 상업적으로 이용해서는 안 됩니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제9조 (지식재산권)</h2>
        <p className={styles.p}>
          서비스 및 리포트에 대한 저작권 등 지식재산권은 회사에 귀속됩니다. 이용자는 개인적·비상업적
          목적으로만 리포트를 이용할 수 있습니다.
        </p>

        <h2 className={styles.h2}>제10조 (회사의 책임과 면책)</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            회사는 안정적인 서비스 제공을 위해 노력하나, 천재지변·외부 서비스(호스팅·AI·결제 등) 장애 등
            회사의 합리적 통제를 벗어난 사유로 인한 손해에 대해서는 책임이 제한될 수 있습니다.
          </li>
          <li className={styles.li}>
            회사는 제5조에 따른 해석의 성격 및 한계 범위 내에서 책임을 부담하며, 이용자가 리포트를 근거로
            내린 결정의 결과에 대해서는 책임지지 않습니다.
          </li>
          <li className={styles.li}>
            본 조의 책임 제한은 회사의 고의 또는 중대한 과실로 인한 손해에는 적용되지 않습니다.
          </li>
        </ul>

        <h2 className={styles.h2}>제11조 (분쟁의 해결 및 관할)</h2>
        <p className={styles.p}>
          본 약관과 관련한 분쟁은 회사와 이용자 간 협의로 해결하며, 협의가 이루어지지 않을 경우 「민사소송법」
          등 관계 법령에 따른 관할 법원에 제소합니다. 소비자인 이용자의 경우 관할은 같은 법의 소비자 보호
          규정에 따릅니다.
        </p>

        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
      </main>
    </div>
  );
}
