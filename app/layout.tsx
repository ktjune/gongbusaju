import type { Metadata } from "next";
import { Nanum_Myeongjo, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Analytics } from "./analytics";

const serif = Nanum_Myeongjo({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

// 브랜드(출처표시)는 "공부결", "공부사주"는 서비스 설명어로만 사용한다.
// (「상표법」 제90조 제1항 제2호 — 기술적 표장의 보통 사용은 상표권 효력 밖)
export const metadata: Metadata = {
  title: "공부결 — 우리 아이 공부의 결을 읽는 공부사주 리포트",
  description:
    "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이하는 공부사주 리포트. 사주 해석과 공공데이터를 분리해 단정이 아닌 참고로 전합니다.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gongbusaju.kr"),
  // 같은 내용이 www.gongbusaju.kr · gongbusaju.kr · *.vercel.app 여러 주소에서
  // 열린다. 어느 것이 정본인지 알려주지 않으면 검색엔진이 중복으로 보고 평가를
  // 나눈다. "./"는 현재 경로를 metadataBase 기준으로 풀어주므로 페이지마다
  // 자기 자신을 가리킨다(루트에 "/"를 박으면 모든 페이지가 홈을 가리켜 버린다).
  alternates: { canonical: "./" },
  openGraph: {
    title: "공부결 — 우리 아이 공부의 결을 읽는 공부사주 리포트",
    description:
      "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이하는 공부사주 리포트.",
    type: "website",
    locale: "ko_KR",
    siteName: "공부결",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "공부결 — 우리 아이 공부의 결을 읽는 공부사주 리포트",
    description:
      "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이하는 공부사주 리포트.",
    images: ["/og-image.png"],
  },
  // 검색엔진 소유 확인 — 각 콘솔이 발급한 값을 env에 넣으면 <head>에 실린다.
  // 값이 없으면 해당 태그를 내보내지 않는다(빈 태그는 확인 실패로 잡힌다).
  // 구글은 public/의 확인 파일로 이미 인증했고, 이쪽은 파일을 못 쓸 때의 대안이다.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION && {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    }),
    ...(process.env.NAVER_SITE_VERIFICATION && {
      other: {
        "naver-site-verification": process.env.NAVER_SITE_VERIFICATION,
      },
    }),
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gongbusaju.kr";

/**
 * 구조화 데이터 — 검색엔진에 "누가 만드는 서비스인지"를 기계가 읽는 형식으로 알린다.
 * 푸터에 이미 적힌 사업자 정보와 같은 값이어야 한다(불일치는 신뢰도를 깎는다).
 *
 * 별점·후기(aggregateRating·review)는 넣지 않는다. 표본이 2건뿐이라 사실상
 * 광고 문구가 되고, 사주 서비스에 성과를 암시하는 지표를 붙이면 표시광고법
 * 리스크가 생긴다(CLAUDE.md 규칙 #3·#7).
 */
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "공부결",
  legalName: "문도어",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description:
    "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이하는 공부사주 리포트 서비스.",
  telephone: "0502-1944-3249",
  founder: { "@type": "Person", name: "권태준" },
  address: {
    "@type": "PostalAddress",
    streetAddress: "동대문구 답십리로68길 31",
    addressLocality: "서울",
    addressCountry: "KR",
  },
  identifier: {
    "@type": "PropertyValue",
    name: "사업자등록번호",
    value: "732-46-01157",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSONLD),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
