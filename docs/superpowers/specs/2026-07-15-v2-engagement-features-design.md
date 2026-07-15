# V2: 참여 유도 기능 4종 (뱃지 · 스트릭 · 주간목표 · 리마인더 알림)

## 배경

V1(`2026-07-15-v1-ui-design-system-design.md`)에서 홈 화면에 스트릭·뱃지 스탯 배지를 도입했지만 현재는 정적 목업 값이다. 이 문서는 그 값들을 실제 백엔드 로직으로 채우고, 추가로 주간 목표·리마인더 알림 기능을 신규로 만드는 범위를 정의한다.

기존 스택: Node.js + Express + Prisma(PostgreSQL) + TypeScript, Vitest/Supertest. 라우트는 `src/routes/*.ts`(HTTP 레이어, `prisma` 직접 사용), 재사용 로직은 `src/services/*.ts`(예: `growth.ts`, `decay.ts`). 인증은 `requireAuth` 미들웨어가 `req.userId`를 채움. 배치 잡은 `src/jobs/*.ts`로 만들고 `src/cron.ts`에 등록, `server.ts`에서만 스케줄 시작(테스트에 영향 없음).

## 데이터 모델 변경 (Prisma)

```prisma
model Badge {
  id          String      @id @default(cuid())
  key         String      @unique
  name        String
  description String
  userBadges  UserBadge[]
}

model UserBadge {
  id       String   @id @default(cuid())
  userId   String
  badgeId  String
  earnedAt DateTime @default(now())
  user     User  @relation(fields: [userId], references: [id])
  badge    Badge @relation(fields: [badgeId], references: [id])
  @@unique([userId, badgeId])
}

model WeeklyGoal {
  id            String   @id @default(cuid())
  userId        String
  category      Category
  targetSeconds Int
  weekStart     DateTime // 해당 주 월요일 00:00 UTC
  user          User @relation(fields: [userId], references: [id])
  @@unique([userId, category, weekStart])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
}
```

`Growth` 모델에 필드 추가:
```prisma
currentStreak Int @default(0)
longestStreak Int @default(0)
```

`User` 모델에 역방향 관계(`userBadges`, `weeklyGoals`, `pushSubscriptions`) 추가.

## 기능 1 — 스트릭(연속일) 실제 계산

`src/services/growth.ts`의 `applySessionToGrowth`에서 gauge 갱신과 함께 처리한다 (세션이 끝나 `verifiedSeconds > 0`일 때만 호출되는 지점이므로 자연스러운 위치).

```ts
function computeStreak(lastActiveDate: Date | null, now: Date, currentStreak: number) {
  const todayKey = dateKey(now);
  const lastKey = lastActiveDate ? dateKey(lastActiveDate) : null;
  if (lastKey === todayKey) return currentStreak;           // 오늘 이미 반영됨
  const yesterdayKey = dateKey(addDays(now, -1));
  if (lastKey === yesterdayKey) return currentStreak + 1;    // 연속
  return 1;                                                  // 끊김 → 오늘부터 새로 시작
}
```
`dateKey`는 `history.ts`에서 이미 쓰는 `toISOString().slice(0,10)` 방식과 동일하게 맞춘다. `longestStreak = Math.max(longestStreak, newStreak)`.

퇴화 배치 잡(`decayJob.ts`)은 gauge만 건드리고 스트릭엔 관여하지 않는다 — 스트릭은 "오늘 인증했는가"만 보므로 놓친 날은 다음 세션 종료 시점에 자연히 1로 리셋된다.

## 기능 2 — 업적/뱃지 실제 구현

**초기 뱃지 카탈로그** (seed 스크립트 `prisma/seed.ts` 신규 또는 기존 seed에 추가):
- 누적시간: 1h, 10h, 50h, 100h (`key: hours_1/10/50/100`)
- 스트릭: 3일, 7일, 30일 (`key: streak_3/7/30`)
- 카테고리: 각 카테고리 첫 5시간 (`key: category_study_5h` 등)

`src/services/badges.ts` 신규:
```ts
async function evaluateBadges(userId: string, growth: Growth, categoryTotals: Record<Category, number>) {
  // 조건 충족하는 badge.key 목록 계산 후,
  // UserBadge에 없는 것만 createMany({ skipDuplicates: true })
}
```
`applySessionToGrowth` 끝에서 호출. `categoryTotals`는 `recomputeDominantCategory`가 이미 전체 세션을 훑으므로 그 계산을 재사용/노출한다.

**API**: `GET /api/badges/me` (requireAuth) → `[{key, name, description, earnedAt: string | null}]` (미획득도 목록에 포함해 "잠금" 표시에 쓸 수 있게).

## 기능 3 — 주간 목표 설정 + 진행률

`src/routes/goals.ts` 신규 (`/api/goals`, requireAuth):
- `GET /api/goals` → 이번 주(`weekStart` = 이번 주 월요일)의 4개 카테고리 각각에 대해 `{category, targetSeconds, achievedSeconds, percent}`. `achievedSeconds`는 `history.ts`와 동일한 방식으로 이번 주 `Session.verifiedSeconds` 합산. 목표가 없는 카테고리는 `targetSeconds: 0`으로 반환(미설정 상태).
- `PUT /api/goals` `{category, targetSeconds}` → upsert (`@@unique([userId, category, weekStart])` 활용). `targetSeconds`는 0 이상 정수만 허용(기존 `isNonEmptyString` 스타일의 검증 헬퍼를 `goals.ts`에 추가).

## 기능 4 — 리마인더 알림 (PWA 푸시)

신규 의존성: `web-push`(백엔드). 환경변수 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (백엔드 `.env.example`에 추가). 프론트는 구독 시 공개키가 필요하므로 `frontend/.env`에 `VITE_VAPID_PUBLIC_KEY`로 동일 값을 별도 노출한다(비밀키는 프론트에 절대 두지 않음).

**구독 저장**: `src/routes/push.ts` 신규 (requireAuth):
- `POST /api/push/subscribe` — 프론트에서 `PushManager.subscribe()` 결과(`endpoint`, `keys.p256dh`, `keys.auth`)를 받아 `PushSubscription` upsert(`endpoint` unique).
- `DELETE /api/push/subscribe` — `{endpoint}` 받아 삭제.

**발송 잡**: `src/jobs/reminderJob.ts` 신규, `cron.ts`에 `cron.schedule('0 20 * * *', runReminderJob)` 등록(매일 20:00, 서버 단일 타임존 기준 — 사용자별 시간대는 MVP 범위 밖). 로직: 오늘 `endedAt`이 있는 `Session`이 하나도 없는 사용자 중 `PushSubscription`이 있는 사람에게 `web-push.sendNotification(...)`으로 "오늘 꾸미랑 시간 보낼까요?" 알림 발송. 만료된 구독(410/404 응답)은 해당 `PushSubscription` row 삭제.

**프론트**: 현재 `frontend/vite.config.ts`의 `VitePWA` 설정은 기본 `generateSW` 전략이라 커스텀 이벤트 리스너를 넣을 수 없다. `strategies: 'injectManifest'` + `srcDir/filename`으로 커스텀 `frontend/src/sw.ts`를 두는 방식으로 전환하고, 그 안에 `push`(알림 표시)와 `notificationclick`(앱 포커스/이동) 리스너를 추가한다. 설정 화면 또는 홈 화면에 "알림 받기" 토글 추가 → `Notification.requestPermission()` → 허용 시 `pushManager.subscribe({applicationServerKey: VAPID_PUBLIC_KEY, userVisibleOnly: true})` → 결과를 `/api/push/subscribe`로 전송.

## 프론트 연동 (V1 목업 → 실데이터)

- `HomePage`의 `StatBadge` 3종을 `getMyGrowth()` 응답 확장(`currentStreak`, `longestStreak`) + 신규 `GET /api/badges/me`(획득 개수) 실데이터로 교체.
- 뱃지 갤러리 화면 신규(`/badges` 라우트, `BadgesPage.tsx`) — 획득/미획득 전체 뱃지 그리드.
- 주간 목표: 홈 또는 히스토리 페이지에 카테고리별 진행률 게이지 추가 + 목표 설정 폼.
- 알림 토글: 헤더 또는 별도 설정 화면.

## 테스트

각 신규 라우트는 기존 컨벤션대로 `<file>.test.ts` colocated, Supertest로 인증/검증/성공 케이스 커버. `computeStreak`, `evaluateBadges`는 순수 함수로 분리해 단위 테스트. `reminderJob`은 `decayJob.test.ts` 패턴을 따라 mock 발송 함수로 대상 선정 로직만 검증(`web-push` 호출 자체는 API 계약 테스트가 아니라 유닛에서 mocking).

## 범위 밖

- 사용자별 타임존 대응 리마인더 시각
- 뱃지/목표 관리자(admin) 화면
- 히스토리 페이지 차트 시각화 강화 (별도 스코프로 취급, 이번 V2에는 미포함)
- 리마인더 알림 문구 개인화/A-B
