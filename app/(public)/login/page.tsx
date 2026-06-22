"use client";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/mypage";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div style={S.card}>
      <div style={S.logo}>공부사주</div>
      <h1 style={S.title}>로그인</h1>
      <form onSubmit={handleSubmit}>
        <input style={S.input} type="email" placeholder="이메일" value={email}
          onChange={e => setEmail(e.target.value)} required autoFocus />
        <input style={S.input} type="password" placeholder="비밀번호" value={password}
          onChange={e => setPassword(e.target.value)} required />
        {error && <p style={S.error}>{error}</p>}
        <button style={S.btn} type="submit" disabled={loading}>
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
      <p style={S.sub}>
        계정이 없으신가요? <Link href={`/signup?next=${encodeURIComponent(next)}`} style={S.link}>회원가입</Link>
      </p>
      <p style={S.sub}>
        <Link href="/apply" style={S.link}>비회원으로 신청하기</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={S.page}>
      <Suspense fallback={<div style={S.card}><p style={{ color: "#5a5f6a" }}>불러오는 중…</p></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7f1", padding: "20px", fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: "40px 36px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", maxWidth: 380 },
  logo: { color: "#b08c3e", fontSize: "0.85rem", letterSpacing: "0.3em", marginBottom: 12, fontWeight: 600 },
  title: { color: "#1f3b63", fontSize: "1.4rem", margin: "0 0 24px", fontWeight: 700 },
  input: { display: "block", width: "100%", padding: "11px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: "1rem", marginBottom: 12, boxSizing: "border-box" as const, fontFamily: "inherit" },
  error: { color: "#c0392b", fontSize: "0.85rem", margin: "0 0 12px" },
  btn: { display: "block", width: "100%", padding: 12, background: "#1f3b63", color: "#fff", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  sub: { textAlign: "center" as const, fontSize: "0.88rem", color: "#5a5f6a", marginTop: 16 },
  link: { color: "#3b6fb5", textDecoration: "none" },
};
