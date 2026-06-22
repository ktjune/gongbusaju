"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/mypage";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message === "User already registered" ? "이미 가입된 이메일입니다." : "가입 중 오류가 발생했습니다.");
      setLoading(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.doneIcon}>✉️</div>
          <h1 style={S.title}>이메일을 확인해주세요</h1>
          <p style={S.desc}>{email}으로 인증 링크를 보냈습니다.<br />링크를 클릭하면 가입이 완료됩니다.</p>
          <p style={S.sub}><Link href="/login" style={S.link}>로그인으로 돌아가기</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>공부사주</div>
        <h1 style={S.title}>회원가입</h1>
        <form onSubmit={handleSubmit}>
          <input style={S.input} type="email" placeholder="이메일" value={email}
            onChange={e => setEmail(e.target.value)} required autoFocus />
          <input style={S.input} type="password" placeholder="비밀번호 (8자 이상)" value={password}
            onChange={e => setPassword(e.target.value)} required />
          <input style={S.input} type="password" placeholder="비밀번호 확인" value={confirm}
            onChange={e => setConfirm(e.target.value)} required />
          {error && <p style={S.error}>{error}</p>}
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? "가입 중…" : "회원가입"}
          </button>
        </form>
        <p style={S.sub}>
          이미 계정이 있으신가요? <Link href={`/login?next=${encodeURIComponent(next)}`} style={S.link}>로그인</Link>
        </p>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7f1", padding: "20px", fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif" },
  card: { background: "#fff", borderRadius: 16, padding: "40px 36px", boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: "100%", maxWidth: 380 },
  logo: { color: "#b08c3e", fontSize: "0.85rem", letterSpacing: "0.3em", marginBottom: 12, fontWeight: 600 },
  title: { color: "#1f3b63", fontSize: "1.4rem", margin: "0 0 24px", fontWeight: 700 },
  doneIcon: { fontSize: "2.5rem", marginBottom: 16, textAlign: "center" as const },
  input: { display: "block", width: "100%", padding: "11px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: "1rem", marginBottom: 12, boxSizing: "border-box" as const, fontFamily: "inherit" },
  error: { color: "#c0392b", fontSize: "0.85rem", margin: "0 0 12px" },
  btn: { display: "block", width: "100%", padding: 12, background: "#1f3b63", color: "#fff", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  desc: { color: "#5a5f6a", lineHeight: 1.7, marginBottom: 20, fontSize: "0.95rem" },
  sub: { textAlign: "center" as const, fontSize: "0.88rem", color: "#5a5f6a", marginTop: 16 },
  link: { color: "#3b6fb5", textDecoration: "none" },
};
