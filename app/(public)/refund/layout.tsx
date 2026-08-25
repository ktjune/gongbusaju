import type { Metadata } from "next";

/**
 * page.tsx가 "use client"라 metadata를 직접 내보낼 수 없어 레이아웃으로 분리한다.
 * 루트와 같은 title을 쓰고 있던 것을 고친다.
 *
 * 환불 창구는 전자상거래법상 노출 의무가 있는 페이지다. 검색으로도 찾을 수
 * 있어야 고객이 헤매지 않는다.
 */
export const metadata: Metadata = {
  title: "환불 요청 — 공부결",
  description:
    "주문번호와 신청 시 남긴 연락처로 환불을 요청합니다. 접수된 요청은 이용약관 제7조에 따라 검토 후 처리해 드립니다.",
  openGraph: {
    title: "환불 요청 — 공부결",
    description: "주문번호와 신청 시 남긴 연락처로 환불을 요청합니다.",
  },
};

export default function RefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
