// TODO: 결과 페이지 (빌드 순서 5단계)
export default async function ResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <div>결과 페이지 — {token}</div>;
}
