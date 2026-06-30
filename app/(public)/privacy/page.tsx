import Link from "next/link";
import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 공부사주",
  description: "공부사주 개인정보처리방침",
};

const EFFECTIVE_DATE = "2026-06-23";

/**
 * 개인정보처리방침 — 「개인정보 보호법」 제30조·시행령 제31조 필수 기재사항 반영.
 * ⚠️ [확인 필요] 표기 항목(사업자 정보·보호책임자·국외이전 리전 등)은 정식 오픈 전 반드시 채워야 함.
 * 본 초안은 변호사 검토 후 사용 권장.
 */
export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <main className={styles.sheet}>
        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.meta}>시행일: {EFFECTIVE_DATE}</p>

        <p className={styles.p}>
          공부사주(이하 &ldquo;회사&rdquo;)는 「개인정보 보호법」 등 관계 법령을 준수하며, 정보주체의
          개인정보를 보호하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다. 특히 본 서비스는
          미성년 자녀의 정보를 법정대리인의 동의를 받아 처리하므로, 안전한 처리에 각별히 유의합니다.
        </p>

        <h2 className={styles.h2}>1. 수집하는 개인정보 항목 및 수집 방법</h2>
        <p className={styles.p}>회사는 리포트 제작·전달을 위해 다음 항목을 수집합니다.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>구분</th>
              <th>항목</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>자녀(리포트 대상)</td>
              <td>생년월일·출생시각, 성별, (선택) 주소, (선택) 재학 기관명</td>
            </tr>
            <tr>
              <td>보호자(신청자)</td>
              <td>이메일, (선택) 휴대전화번호, 법정대리인 동의 기록</td>
            </tr>
            <tr>
              <td>자동 생성·수집</td>
              <td>접속 로그, 쿠키(로그인 세션 유지), 결제 시 결제수단 정보(결제대행사 처리)</td>
            </tr>
          </tbody>
        </table>
        <p className={styles.p}>
          수집 방법: 신청 폼을 통한 보호자의 직접 입력, 서비스 이용 과정에서의 자동 생성.
        </p>

        <h2 className={styles.h2}>2. 개인정보의 처리 목적</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>사주 리포트 제작(만세력 계산·해석) 및 전달</li>
          <li className={styles.li}>(주소 입력 시) 공공데이터 기반 예상 배정 학교·학교군 안내</li>
          <li className={styles.li}>결과 링크 발송 및 신청·검수 관련 안내(이메일·알림톡 등)</li>
          <li className={styles.li}>요금 결제 및 환불, 문의 응대, 부정이용 방지</li>
        </ul>

        <h2 className={styles.h2}>3. 개인정보의 보유 및 이용 기간</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            자녀·보호자 개인정보: 동의일로부터 <b>6개월</b> 보관 후 지체 없이 파기. (다만 정보주체의
            삭제 요청 시 즉시 파기)
          </li>
          <li className={styles.li}>
            관계 법령상 보존 의무가 있는 경우 해당 기간 보관: 전자상거래 등에서의 소비자보호에 관한
            법률에 따른 계약·청약철회 기록 5년, 대금결제·재화공급 기록 5년, 소비자 불만·분쟁처리 기록
            3년 등.
          </li>
        </ul>

        <h2 className={styles.h2}>4. 만 14세 미만 아동의 개인정보 처리</h2>
        <p className={styles.p}>
          본 서비스는 리포트 대상이 만 14세 미만 아동인 경우가 많습니다. 회사는 「개인정보 보호법」
          제22조의2에 따라 <b>법정대리인의 동의</b>를 받은 후에만 아동의 개인정보를 처리하며, 법정대리인이
          동의하였는지를 확인합니다. 법정대리인은 언제든지 아동의 개인정보에 대한 열람·정정·삭제·처리정지를
          요구할 수 있습니다.
        </p>

        <h2 className={styles.h2}>5. 개인정보의 제3자 제공</h2>
        <p className={styles.p}>
          회사는 정보주체의 개인정보를 본 방침에 명시한 범위를 넘어 제3자에게 제공하지 않습니다. 다만
          법령에 특별한 규정이 있거나 수사기관의 적법한 요청이 있는 경우는 예외로 합니다.
        </p>

        <h2 className={styles.h2}>6. 개인정보 처리의 위탁 (국외 위탁 포함)</h2>
        <p className={styles.p}>
          회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 일부 수탁사는 국외에
          소재합니다. 위탁계약 시 개인정보가 안전하게 관리되도록 필요한 사항을 규정합니다.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>수탁사</th>
              <th>위탁 업무</th>
              <th>이전 정보·국가</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>데이터베이스 저장(암호화된 개인정보)</td>
              <td>암호화 저장 데이터 / 대한민국 (AWS 서울 리전)</td>
            </tr>
            <tr>
              <td>Vercel Inc.</td>
              <td>웹 호스팅·서버 운영</td>
              <td>서비스 이용 데이터 / 미국</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>결과·안내 이메일 발송</td>
              <td>보호자 이메일 주소 / 미국</td>
            </tr>
            <tr>
              <td>카카오(Kakao)</td>
              <td>주소 → 좌표 변환(지오코딩)</td>
              <td>입력 주소 / 대한민국</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>사주 해석 산문 생성(AI)</td>
              <td>식별정보를 제외한 사주 계산값(학교명·이름·생년월일 등 미전송) / 미국</td>
            </tr>
            <tr>
              <td>
                <span className={styles.todo}>[예정] 토스페이먼츠/카카오페이</span>
              </td>
              <td>결제 처리</td>
              <td>결제 관련 정보 / 대한민국</td>
            </tr>
          </tbody>
        </table>
        <p className={styles.callout}>
          <b>개인정보 국외 이전 고지</b> (「개인정보 보호법」 제28조의8)
          <br />위 수탁사 중 Vercel·Resend·Anthropic은 미국에 서버를 두고 있어, 처리 과정에서 개인정보가
          국외로 이전됩니다. (Supabase는 대한민국 서울 리전, 카카오·결제대행사는 국내)
          <br />· 이전받는 자 / 국가: Vercel·Resend·Anthropic / 미국
          <br />· 이전 항목: 위 표의 수탁사별 항목 (보호자 이메일, 서비스 이용 데이터, 식별정보를 제외한 사주 계산값)
          <br />· 이전 일시 및 방법: 서비스 이용 시점에 암호화된 통신(HTTPS/TLS)으로 전송
          <br />· 보유·이용 기간: 위탁 목적 달성 또는 회사의 개인정보 보유기간(6개월)까지
          <br />· 정보주체는 국외 이전을 거부할 수 있으나, 거부 시 서비스 제공이 제한될 수 있습니다.
        </p>

        <h2 className={styles.h2}>7. 개인정보의 파기절차 및 방법</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            파기절차: 보유기간이 경과하거나 처리목적이 달성된 개인정보는 지체 없이 파기합니다.
          </li>
          <li className={styles.li}>
            파기방법: 전자적 파일은 복구·재생이 불가능한 방법으로 영구 삭제하며, 출력물은 분쇄 또는
            소각합니다.
          </li>
        </ul>

        <h2 className={styles.h2}>8. 정보주체와 법정대리인의 권리·의무 및 행사 방법</h2>
        <p className={styles.p}>
          정보주체(및 만 14세 미만 아동의 법정대리인)는 언제든지 개인정보 열람·정정·삭제·처리정지 및
          동의 철회를 요구할 수 있습니다. 요청은 아래 개인정보 보호책임자에게 이메일 등으로 하실 수 있으며,
          회사는 지체 없이 조치합니다.
        </p>

        <h2 className={styles.h2}>9. 개인정보의 안전성 확보 조치</h2>
        <ul className={styles.ul}>
          <li className={styles.li}>
            암호화: 자녀의 생년월일시·주소·학교 등 민감도 높은 항목은 저장 시 AES-256-GCM으로 암호화하며,
            식별정보와 분리하여 저장합니다.
          </li>
          <li className={styles.li}>접근통제: 관리자 페이지 접근 통제 및 권한 최소화.</li>
          <li className={styles.li}>전송 구간 암호화(HTTPS) 적용.</li>
        </ul>

        <h2 className={styles.h2}>10. 쿠키 등 자동 수집 장치의 설치·운영 및 거부</h2>
        <p className={styles.p}>
          회사는 로그인 세션 유지 등을 위해 쿠키를 사용합니다. 이용자는 웹브라우저 설정에서 쿠키 저장을
          거부할 수 있으나, 이 경우 로그인 등 일부 기능 이용이 제한될 수 있습니다.
        </p>

        <h2 className={styles.h2}>11. 개인정보 보호책임자</h2>
        <table className={styles.table}>
          <tbody>
            <tr>
              <th>책임자</th>
              <td>권태준 (대표)</td>
            </tr>
            <tr>
              <th>연락처</th>
              <td>0502-1944-3249 · moondoor_main@naver.com</td>
            </tr>
          </tbody>
        </table>

        <h2 className={styles.h2}>12. 권익침해 구제 방법</h2>
        <p className={styles.p}>
          개인정보 침해로 인한 상담·신고는 아래 기관에 문의하실 수 있습니다.
        </p>
        <ul className={styles.ul}>
          <li className={styles.li}>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
          <li className={styles.li}>개인정보침해 신고센터 (privacy.kisa.or.kr / 118)</li>
          <li className={styles.li}>대검찰청 사이버수사과 (1301), 경찰청 사이버수사국 (182)</li>
        </ul>

        <h2 className={styles.h2}>13. 처리방침의 변경</h2>
        <p className={styles.p}>
          본 방침은 시행일부터 적용되며, 법령·서비스 변경에 따라 개정될 수 있습니다. 개정 시 변경 사항을
          시행 7일 전(중요한 변경은 30일 전)부터 공지합니다.
        </p>

        <Link href="/" className={styles.back}>
          ← 홈으로
        </Link>
      </main>
    </div>
  );
}
