-- orders에 신청자(보호자) 성명 컬럼 추가 (2026-08-27)
--
-- 목적: 환불 문의가 오면 이름으로 주문을 찾아야 한다. 지금 어드민은 연락처만
-- 보여줘서 전화로 "○○○인데요" 하면 대조할 방법이 없었다.
--
-- ⚠️ 컬럼명은 반드시 camelCase + 큰따옴표. Prisma가 그 이름으로 조회하므로
--    snake_case(buyer_name)로 만들면 운영이 조용히 깨진다.
--
-- 값은 contactEmail·contactPhone과 같이 애플리케이션에서 암호화해 넣는다
-- (lib/orders/prisma-store.ts의 encryptPiiNullable). DB에는 암호문이 저장된다.
--
-- nullable이므로 기존 주문에는 영향이 없다(기존 건은 NULL로 남고 어드민에서
-- 이름 줄이 표시되지 않을 뿐이다).
--
-- ⚠️ 배포 순서: 이 SQL을 **먼저** 실행하고 코드를 배포해야 한다.
--    코드가 먼저 나가면 주문 생성이 "컬럼 없음"으로 실패한다.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "buyerName" text;

-- 확인
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'orders' AND column_name = 'buyerName';
