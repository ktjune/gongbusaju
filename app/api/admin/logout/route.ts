/**
 * POST /api/admin/logout
 * admin_session 쿠키 삭제
 */
export const runtime = "nodejs";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}
