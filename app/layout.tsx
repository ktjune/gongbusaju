import type { Metadata } from "next";
import { Nanum_Myeongjo, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
