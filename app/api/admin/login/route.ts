/**
 * POST /api/admin/login
 * 비밀번호 검증 후 admin_session 쿠키 발급 (서명된 토큰 — 비밀번호 원문 미저장)
 */
import { createAdminSessionToken, safeCompare } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return Response.json({ error: "ADMIN_PASSWORD 미설정" }, { status: 503 });
  }
  if (!password || !(await safeCompare(password, adminPassword))) {
    return Response.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  const token = await createAdminSessionToken(adminPassword);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    },
  });
}
