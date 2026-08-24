# 리포트 자동 복구 크론 (`/api/worker/run`)

## 왜 필요한가

리포트 생성은 `/api/order`의 `waitUntil()` **한 번**으로만 시작된다.
그게 함수 시간 초과나 LLM 오류로 죽으면 주문은 `paid`/`generating`/`failed`에
멈춘 채 **재시도도 알림도 없다**. 고객은 돈을 내고 아무것도 못 받는다.

`/api/worker/run`이 그 안전망이다. 호출될 때마다 한 건을 처리한다:

1. `paid` 대기 주문 (FIFO)
2. 없으면 `failed`(15분 경과) / 고착 `generating`(10분 경과) 중 시도 6회 미만인 것

## Vercel 크론을 쓸 수 없다

Hobby 플랜은 크론이 **하루 1회**로 제한된다. `* * * * *`를 넣으면 배포 자체가
거부된다(2026-08-24 확인):

```
Hobby accounts are limited to daily cron jobs.
This cron expression (* * * * *) would run more than once per day.
```

하루 1회로는 안전망 역할을 못 한다(한 번에 한 건만 처리하므로). 그래서
`vercel.json`에는 `cleanup-pii`만 남기고, 아래 둘 중 하나로 운영한다.

## 방법 A — 외부 크론 (무료, 현재 방식)

[cron-job.org](https://cron-job.org) 등에서 1분 간격으로 호출한다.

- URL: `https://www.gongbusaju.kr/api/worker/run`
- 메서드: `GET`
- 헤더: `Authorization: Bearer <CRON_SECRET>`

`CRON_SECRET`은 Vercel 프로덕션 env에 이미 있는 값과 같아야 한다.
틀리면 401, 서버에 미설정이면 503이 돌아온다.

응답으로 동작을 확인할 수 있다:
- `{"status":"idle","queued":0}` — 처리할 주문 없음 (정상)
- `{"status":"started","kind":"paid"|"retry",...}` — 생성 시작

## 방법 B — Vercel Pro ($20/월)

Pro로 올리면 `vercel.json`에 아래를 되살리면 된다. 외부 의존이 사라지고
`maxDuration` 상한도 60s → 300s로 올라간다(리포트 생성이 ~40-50s라 여유가 생긴다).

```json
{ "path": "/api/worker/run", "schedule": "* * * * *" }
```

## 주의 — 크론을 켜기 전에

`paid`/`failed`/`generating` 상태의 옛 주문이 있으면 크론이 전부 재생성
대상으로 집어간다. 2026-08-24에 12건을 `scripts/close-stale-orders.sql`로
정리했다. 다시 켤 때도 같은 확인이 필요하다:

```sql
SELECT status, count(*) FROM orders
 WHERE status IN ('generating','failed','paid') GROUP BY status;
```
