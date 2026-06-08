// TODO: 결과 페이지 (빌드 순서 5단계)
export default function ResultPage({ params }: { params: { token: string } }) {
  return <div>결과 페이지 — {params.token}</div>;
}
