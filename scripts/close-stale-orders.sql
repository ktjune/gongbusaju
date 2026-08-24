-- 운영 전 고착 주문 정리 (2026-08-24)
--
-- 대상: status IN ('generating','failed','paid') 12건 — 2026-06-11 ~ 08-02 생성.
--   · 11건은 paymentKey가 없다 (결제 게이트 도입 전 테스트 주문)
--   · 1건(cmrk1el7)은 tgen_ 접두사 = 토스 테스트 결제
--   → 실결제 건이 없으므로 정산·환불 의무 없음.
--
-- 이유: /api/worker/run 크론이 켜지는 순간 이 12건을 전부 재생성 대상으로 집어
--   LLM 비용을 태우고 검수 큐를 오염시킨다. 생성은 review에서 멈추고 고객
--   알림은 나가지 않으므로(lib/orders/generate.ts) 안전 문제는 없으나 무의미하다.
--
-- generateAttempts=6 (MAX_GENERATE_ATTEMPTS) → 자동 재시도 필터에서 제외.
-- status='rejected'  → worker가 조회하지 않는 상태. 어드민에서 사람이 판단해
--                      재생성하는 것은 여전히 가능하다.
--
-- 되돌리기: scratchpad/orders-backup-20260824.json 에 이전 status/attempts 보관.

BEGIN;

SELECT id, status, "generateAttempts", "paymentKey", "createdAt"
  FROM orders
 WHERE status IN ('generating', 'failed', 'paid');

UPDATE orders
   SET status = 'rejected',
       "generateAttempts" = 6,
       "updatedAt" = now()
 WHERE status IN ('generating', 'failed', 'paid');

-- 위 UPDATE가 12건인지 확인한 뒤 COMMIT, 아니면 ROLLBACK.
COMMIT;
