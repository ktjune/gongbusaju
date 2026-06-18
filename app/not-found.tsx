/**
 * app/not-found.tsx — 커스텀 404 페이지
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf7f1",
        color: "#2c2c30",
        fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>🔍</div>
        <h1
          style={{
            color: "#1f3b63",
            fontSize: "1.4rem",
            margin: "0 0 10px",
          }}
        >
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ color: "#5a5f6a", lineHeight: 1.7, margin: "0 0 24px" }}>
          주소가 올바른지 확인해 주세요.
          <br />
          리포트 링크는 발행 시 발급된 고유 주소입니다.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            background: "#1f3b63",
            color: "#fff",
            padding: "12px 28px",
            borderRadius: 10,
            textDecoration: "none",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          홈으로
        </a>
      </div>
    </div>
  );
}
