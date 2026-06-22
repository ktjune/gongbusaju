import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from = "/admin", error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const password = formData.get("password") as string;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || password !== adminPassword) {
      redirect(`/admin/login?from=${encodeURIComponent(from)}&error=1`);
    }

    (await cookies()).set("admin_session", adminPassword, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    redirect(from);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#faf7f1", fontFamily: "sans-serif",
    }}>
      <form action={login} style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)", width: 320,
      }}>
        <h1 style={{ margin: "0 0 24px", fontSize: "1.2rem", color: "#1f3b63" }}>
          공부사주 Admin
        </h1>
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid #ddd", fontSize: "1rem", boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        {error && (
          <p style={{ color: "#c0392b", fontSize: "0.85rem", margin: "0 0 12px" }}>
            비밀번호가 틀렸습니다.
          </p>
        )}
        <button
          type="submit"
          style={{
            width: "100%", padding: "11px", background: "#1f3b63", color: "#fff",
            border: "none", borderRadius: 8, fontSize: "1rem", cursor: "pointer",
          }}
        >
          로그인
        </button>
      </form>
    </div>
  );
}
