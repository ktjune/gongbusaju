"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button onClick={handleLogout} style={{ background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#5a5f6a", fontSize: "0.88rem", fontFamily: "inherit" }}>
      로그아웃
    </button>
  );
}
