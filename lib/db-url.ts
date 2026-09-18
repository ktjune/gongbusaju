/**
 * lib/db-url.ts — 서버리스에 맞는 풀러 포트로 접속 주소를 보정한다.
 *
 * 왜: DATABASE_URL이 Supabase **세션 풀러(5432)** 를 가리키고 있었다. 세션 모드는
 * 연결 하나를 세션이 끝날 때까지 통째로 붙든다. 요청마다 인스턴스가 새로 뜨는
 * Vercel에서는 자리가 금방 동난다 — 2026-09-18 실측에서 pg_stat_activity의
 * Supavisor 연결 15개(= pool_size 한도 전부)가 idle로 5분 넘게 점유돼 있었고,
 * 어드민이 API 8개를 동시에 부를 때 특히 드러났다("어드민이 버벅인다").
 * Supabase 자신도 서버리스에는 **트랜잭션 풀러(6543)** 를 권하고, 세션 풀러는
 * "IPv4 환경에서 직접 연결의 대안"으로만 안내한다.
 *
 * 왜 환경변수를 고치지 않고 코드에서 바꾸나: DATABASE_URL에는 DB 비밀번호가 들어 있다.
 * 주소의 포트만 바꾸자고 사람이 비밀번호를 꺼내 다루게 만들 이유가 없다. 여기서
 * 바꾸면 변경 이력도 남고 테스트로 고정된다.
 *
 * 비밀번호 부분(userinfo)은 절대 건드리지 않는다 — URL 객체로 파싱해 되쓰면
 * 인코딩이 바뀌어 비밀번호가 깨질 수 있어, 마지막 '@' 뒤쪽만 문자열로 손본다.
 *
 * 되돌리려면 환경변수 DB_POOLER_MODE=session 을 주면 원래 주소를 그대로 쓴다.
 */

const SUPABASE_POOLER_HOST = ".pooler.supabase.com";

export function toServerlessPoolerUrl(
  raw: string | undefined,
  mode: string | undefined = undefined
): string | undefined {
  if (!raw) return raw;
  if ((mode ?? "").toLowerCase() === "session") return raw;

  const at = raw.lastIndexOf("@");
  if (at < 0) return raw;

  const head = raw.slice(0, at + 1); // 스킴 + 사용자·비밀번호 — 손대지 않는다
  let tail = raw.slice(at + 1); // host:port/db?params

  const hostPart = tail.split(/[:/?]/, 1)[0];
  if (!hostPart.endsWith(SUPABASE_POOLER_HOST)) return raw;
  if (!/:5432(?=[/?]|$)/.test(tail)) return raw;

  tail = tail.replace(/:5432(?=[/?]|$)/, ":6543");
  if (!/[?&]pgbouncer=/.test(tail)) {
    tail += (tail.includes("?") ? "&" : "?") + "pgbouncer=true";
  }
  return head + tail;
}
