import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/mypage");

  const prisma = getPrisma();

  // 내 주문 + 리포트
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const reportIds = orders.map(o => o.reportId).filter(Boolean) as string[];
  const reports = reportIds.length
    ? await prisma.report.findMany({ where: { id: { in: reportIds } } })
    : [];
  const reportMap = new Map(reports.map(r => [r.id, r]));

  return (
    <div style={S.page}>
      <div style={S.sheet}>
        <div style={S.header}>
          <div>
            <div style={S.logo}>공부사주</div>
            <h1 style={S.title}>내 리포트</h1>
            <p style={S.email}>{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        {orders.length === 0 ? (
          <div style={S.empty}>
            <p>아직 신청 내역이 없습니다.</p>
            <Link href="/apply" style={S.applyBtn}>리포트 신청하기</Link>
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>요금제</th>
                <th style={S.th}>상태</th>
                <th style={S.th}>신청일</th>
                <th style={S.th}>리포트</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const report = order.reportId ? reportMap.get(order.reportId) : null;
                return (
                  <tr key={order.id}>
                    <td style={S.td}>
                      <span style={order.tier === "premium" ? S.chipP : S.chipB}>{order.tier}</span>
                    </td>
                    <td style={S.td}>{statusLabel(order.status)}</td>
                    <td style={S.td}>{new Date(order.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td style={S.td}>
                      {report?.reviewStatus === "approved" ? (
                        <Link href={`/result/${report.token}`} style={S.link}>보기 →</Link>
                      ) : report ? (
                        <span style={S.pending}>검수 중</span>
                      ) : (
                        <span style={S.pending}>생성 중</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 32 }}>
          <Link href="/apply" style={S.applyBtn}>새 리포트 신청하기</Link>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    paid: "접수됨", generating: "생성 중", review: "검수 중",
    published: "완료", rejected: "재작성 중", failed: "오류",
  };
  return map[status] ?? status;
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#faf7f1", padding: "40px 20px", fontFamily: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif" },
  sheet: { maxWidth: 720, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  logo: { color: "#b08c3e", fontSize: "0.8rem", letterSpacing: "0.3em", marginBottom: 6, fontWeight: 600 },
  title: { color: "#1f3b63", fontSize: "1.5rem", margin: "0 0 4px" },
  email: { color: "#5a5f6a", fontSize: "0.88rem", margin: 0 },
  empty: { background: "#fff", borderRadius: 12, padding: "48px", textAlign: "center" as const, color: "#5a5f6a" },
  table: { width: "100%", borderCollapse: "collapse" as const, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 6px rgba(31,59,99,0.06)" },
  th: { textAlign: "left" as const, padding: "12px 16px", background: "#efe9dd", color: "#1f3b63", fontSize: "0.85rem" },
  td: { padding: "14px 16px", borderTop: "1px solid #e3ddd1", fontSize: "0.92rem" },
  chipB: { background: "#eef0f3", color: "#34507a", borderRadius: 12, padding: "2px 10px", fontSize: "0.8rem" },
  chipP: { background: "#1f3b63", color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: "0.8rem" },
  link: { color: "#3b6fb5", textDecoration: "none", fontWeight: 600 },
  pending: { color: "#9a9fa8", fontSize: "0.88rem" },
  applyBtn: { display: "inline-block", background: "#1f3b63", color: "#fff", padding: "12px 28px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: "0.95rem" },
};
