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

---

# 수신 미확인 경보 크론 (`/api/worker/notify-audit`)

## 왜 필요한가

솔라피는 발송 API에 HTTP 200으로 **접수**만 답한다. 접수 이후 카카오 단계에서
떨어지는 건은 응답에 나타나지 않고 발송 결과 웹훅으로만 온다
(`/api/solapi-webhook`). 그 웹훅마저 오지 않으면 — URL 미등록, 배포 중 수신 실패,
솔라피의 재전송 포기 — "돈은 받았는데 고객은 못 받은" 상태가 조용히 남는다.
2026-09-16 주문이 정확히 그랬고, 고객이 연락할 때까지 5일 동안 몰랐다.

이 크론이 마지막 안전망이다. 발행 후 3시간이 지나도록 수신 확인이 없는 주문을
찾아 운영자에게 메일로 알린다. **대상은 연락처가 전화번호뿐인 고객만**이다
(이메일 고객은 이메일이 안전망이고, 이메일에는 수신 확인이 없어 포함시키면
매일 거짓 경보가 난다).

평소에는 0건이어야 정상이다.

## 운영 방법

`vercel.json`에 하루 1회(`0 2 * * *`, KST 11시)로 걸어 두었다 — 설정 없이
바로 도는 기본값이다. 다만 하루 1회면 최악의 경우 하루 늦게 안다.

`/api/worker/run`용 외부 크론을 이미 쓰고 있으므로, **같은 곳에 1시간 간격으로
하나 더 거는 편이 낫다.** 그 경우 `vercel.json`의 `notify-audit` 항목은 빼도 된다.

- URL: `https://www.gongbusaju.kr/api/worker/notify-audit`
- 메서드: `GET`
- 헤더: `Authorization: Bearer <CRON_SECRET>`
- 간격: 1시간

응답:
- `{"status":"done","found":0,"alerted":0,"orderIds":[]}` — 정상
- `found`가 0이 아니면 그 주문들은 솔라피 콘솔 발송 내역을 확인해야 한다.
  한 번 경보한 주문은 다시 울리지 않는다(`orders.notifyAuditedAt`).
