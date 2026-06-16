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

export const metadata: Metadata = {
  title: "공부사주 — 우리 아이의 타고난 공부 결",
  description:
    "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이하는 사주 리포트. 사주 해석과 공공데이터를 분리해 단정이 아닌 참고로 전합니다.",
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
