import Script from "next/script";
import { GA_ID } from "@/lib/analytics";

/**
 * Google Analytics 4 태그.
 *
 * `NEXT_PUBLIC_GA_ID` 미설정이면 아무 것도 렌더하지 않는다 —
 * 로컬 개발에서 통계가 오염되지 않고, 키 없이도 빌드가 돈다.
 *
 * `afterInteractive`: 페이지가 상호작용 가능해진 뒤 로드한다. 측정 때문에
 * 신청·결제 화면이 늦게 뜨면 안 된다.
 *
 * 개인정보처리방침 제6조(위탁)·제10조(쿠키)에 이 수집을 고지하고 있다.
 * 태그를 켜고 끌 때 그 문서도 같이 맞춰야 한다.
 */
export function Analytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
