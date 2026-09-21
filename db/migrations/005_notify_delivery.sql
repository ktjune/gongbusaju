-- 005_notify_delivery.sql
-- 컬럼명은 camelCase + 따옴표 (Prisma 매핑, @map 미사용 — 002_auth.sql 참고)
--
-- 왜: 솔라피는 HTTP 200으로 "접수"만 답하고, 실제 발송 성공·실패는 나중에
-- 웹훅으로 알려준다. 그 결과를 받아 둘 곳이 없어서 2026-09-16 주문의 알림톡이
-- 카카오 단계에서 사라졌는데도 notifyError가 null로 남았다.

-- 솔라피 발송 결과 웹훅이 "수신 완료"로 확인해 준 시각. null = 아직 미확인.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "notifyDeliveredAt" TIMESTAMP(3);

-- "발송했는데 수신 확인이 안 온다" 경보를 운영자에게 보낸 시각.
-- 같은 주문으로 매일 경보가 반복되지 않게 하는 표시.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "notifyAuditedAt" TIMESTAMP(3);

-- 이미 발행된 과거 주문은 "경보 보냄"으로 표시해 둔다.
--
-- 이 표시가 없으면 배포 직후 첫 감사(/api/worker/notify-audit)가 과거 발행 주문을
-- 전부 "수신 미확인"으로 집어 든다. 웹훅이 생기기 전에 나간 발송이라 수신 확인이
-- 있을 수 없기 때문이다 — 사장님 메일함에 수십 통이 한꺼번에 떨어진다.
-- 감사는 이 마이그레이션 이후 발행되는 주문부터 의미가 있다.
UPDATE orders
   SET "notifyAuditedAt" = NOW()
 WHERE status = 'published'
   AND "notifyAuditedAt" IS NULL;
