"use client";

/**
 * app/error.tsx — 전역 에러 바운더리
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>⚠️</div>
        <h1
          style={{
            color: "#1f3b63",
            fontSize: "1.4rem",
            margin: "0 0 10px",
          }}
        >
          오류가 발생했습니다
        </h1>
        <p style={{ color: "#5a5f6a", lineHeight: 1.7, margin: "0 0 24px" }}>
          일시적인 오류입니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#1f3b63",
            color: "#fff",
            border: "none",
            padding: "12px 28px",
            borderRadius: 10,
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
