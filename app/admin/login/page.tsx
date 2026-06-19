"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push(from);
      } else {
        const data = await res.json();
        setError(data.error ?? "로그인 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#faf7f1", fontFamily: "sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: 320,
      }}>
        <h1 style={{ margin: "0 0 24px", fontSize: "1.2rem", color: "#1f3b63" }}>
          공부사주 Admin
        </h1>
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid #ddd", fontSize: "1rem", boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        {error && (
          <p style={{ color: "#c0392b", fontSize: "0.85rem", margin: "0 0 12px" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "11px", background: "#1f3b63", color: "#fff",
            border: "none", borderRadius: 8, fontSize: "1rem", cursor: "pointer",
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
