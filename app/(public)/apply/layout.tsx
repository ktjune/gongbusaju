import type { Metadata } from "next";

/**
 * page.tsx가 "use client"라 metadata를 직접 내보낼 수 없어 레이아웃으로 분리한다.
 *
 * 이 페이지가 루트와 같은 title을 쓰고 있었다. 검색엔진은 중복 title을 약한
 * 신호로 보고, 검색 결과에 무엇이 보일지도 우리가 못 정하게 된다.
 * 신청 페이지는 전환 경로라 문구가 특히 중요하다.
 *
 * 브랜드(출처표시)는 "공부결"만 쓴다 — "공부사주"는 설명어 위치에만 둔다.
 * 단정·보장 표현 금지(표시광고법): "참고·경향"으로 쓰고 "예측·보장"은 쓰지 않는다.
 */
export const metadata: Metadata = {
  title: "리포트 신청 — 공부결",
  description:
    "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이한 공부사주 리포트를 신청합니다. 주소를 남기면 통학 가능한 학교 정보를 함께 담아 드립니다.",
  openGraph: {
    title: "리포트 신청 — 공부결",
    description:
      "자녀의 생년월일시로 공부 기질과 성장 흐름을 풀이한 공부사주 리포트를 신청합니다.",
  },
};

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
