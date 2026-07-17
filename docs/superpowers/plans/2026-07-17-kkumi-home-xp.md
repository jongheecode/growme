# 꾸미 홈 + XP 성장 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 할일(Task)을 직접 만들고 완료해 XP를 얻고, 꾸미가 종(species)·단계(stage)·성격(personality)을 갖고 성장하는 것을 RN 홈 화면에서 볼 수 있게 한다.

**Architecture:** 백엔드에 `Task`/`GrowthProfile` Prisma 모델과 `/api/tasks`, `/api/growth/me` 라우트를 추가하고 기존 시간 게이지 기반 `Growth`/decay 코드를 삭제한다. XP 합계·성장 단계·성격 유형은 저장하지 않고 매 요청마다 `Task` 완료 이력에서 계산한다(기존 `recomputeDominantCategory` 패턴과 동일). 모바일은 API 클라이언트 → 프레젠테이션 컴포넌트(꾸미 표시, 정보 모달, 할일 시트) → 화면 통합 순으로 쌓는다. 꾸미/배경의 실제 시각 자산은 만들지 않고 회색 도형 placeholder로 대체한다(species/stage를 key로 하는 컴포넌트 구조만 만듦). 시트 확장 애니메이션은 새 의존성 없이 React Native 내장 `Animated` API로 구현한다(reanimated는 추가 babel/네이티브 설정이 필요해 이 규모에는 과함).

**Tech Stack:** Express + Prisma(PostgreSQL) + vitest + supertest (백엔드, 기존 스택 그대로), Expo(React Native, TypeScript) + jest-expo + @testing-library/react-native (모바일, 기존 스택 그대로). 새 라이브러리 추가 없음.

## Global Constraints

- 기존 인증(JWT, `AuthContext`)과 서브프로젝트 1의 네비게이션 구조(`RootNavigator`/`AuthStack`/`MainTabs`)를 변경하지 않는다.
- `Session`/`Activity` 모델과 `backend/src/routes/sessions.ts`, `backend/src/jobs/staleSessionJob.ts`는 삭제하지 않는다(서브프로젝트 5 타이머 재사용 예정) — `growth` 연동 코드만 제거한다.
- 웹 `frontend/`는 이번에도 수정·삭제하지 않는다.
- 실제 시각 자산(꾸미 아트, 배경 아트)은 만들지 않는다 — 회색 도형/색상 블록 placeholder만 구현.
- 백엔드 테스트(`cd backend && npm test`)는 실제 PostgreSQL(`growme-postgres` Docker 컨테이너)에 연결한다 — 실행 전 Docker Desktop과 컨테이너가 떠 있는지 확인할 것.
- `Difficulty` → XP 매핑은 고정값: `EASY=10, MEDIUM=20, HARD=35`.
- 성격 계산은 완료+실패 `Task` 합계가 3건 미만이면 `null`을 반환한다.

---

## Task 1: 기존 Growth/decay 코드 제거 + Task/GrowthProfile 스키마 추가

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/cron.ts`
- Modify: `backend/src/routes/sessions.ts`
- Modify: `backend/src/constants.ts`
- Delete: `backend/src/services/growth.ts`, `backend/src/services/growth.test.ts`
- Delete: `backend/src/routes/growth.ts`, `backend/src/routes/growth.test.ts`
- Delete: `backend/src/services/decay.ts`, `backend/src/services/decay.test.ts`
- Delete: `backend/src/jobs/decayJob.ts`, `backend/src/jobs/decayJob.test.ts`

**Interfaces:**
- Produces: Prisma models `Task`, `GrowthProfile` and enums `Difficulty`, `TaskStatus`, `Species` (used by every later task). `Task` fields: `id, userId, title, category(Category), difficulty(Difficulty), xpValue(Int), dueAt(DateTime), status(TaskStatus, default PENDING), completedAt(DateTime?), createdAt(DateTime)`. `GrowthProfile` fields: `id, userId(unique), species(Species?), createdAt`.

이 태스크는 스키마/삭제 작업이라 TDD 사이클 대신 "정리 후 기존 스위트가 통과하는지 확인"으로 검증한다.

- [ ] **Step 1: `backend/prisma/schema.prisma`에서 `Growth` 모델을 삭제하고 새 모델/enum 추가**

`model Growth { ... }` 블록 전체를 삭제하고, `User` 모델의 `growth Growth?` 줄을 `tasks Task[]`와 `growthProfile GrowthProfile?`로 교체한다. 파일 끝(또는 `Category` enum 근처)에 아래를 추가한다:

```prisma
enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum TaskStatus {
  PENDING
  COMPLETED
  FAILED
}

enum Species {
  SPECIES_A
  SPECIES_B
  SPECIES_C
}

model Task {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  category    Category
  difficulty  Difficulty
  xpValue     Int
  dueAt       DateTime
  status      TaskStatus @default(PENDING)
  completedAt DateTime?
  createdAt   DateTime   @default(now())
}

model GrowthProfile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  species   Species?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: 스키마를 dev/test DB에 반영**

Run:
```bash
cd backend
npx prisma generate
npx prisma db push
npm run test:setup
```
Expected: 세 명령 모두 에러 없이 완료. (`test:setup`은 `TEST_DATABASE_URL` 환경변수가 설정되어 있어야 함 — 없으면 `.env.test` 확인.)

- [ ] **Step 3: 옛 Growth/decay 파일 삭제**

Run:
```bash
cd backend
rm src/services/growth.ts src/services/growth.test.ts
rm src/routes/growth.ts src/routes/growth.test.ts
rm src/services/decay.ts src/services/decay.test.ts
rm src/jobs/decayJob.ts src/jobs/decayJob.test.ts
```

- [ ] **Step 4: `backend/src/app.ts`에서 growth 라우터 제거**

`import growthRouter from './routes/growth';` 줄과 `app.use('/api/growth', growthRouter);` 줄을 삭제한다. (다음 태스크에서 새 `/api/growth` 라우터를 다시 추가한다.)

- [ ] **Step 5: `backend/src/cron.ts`에서 decay job 제거**

```ts
import cron from 'node-cron';
import { closeStaleSessions } from './jobs/staleSessionJob';

export function registerCronJobs() {
  cron.schedule('*/5 * * * *', closeStaleSessions);
}
```

- [ ] **Step 6: `backend/src/routes/sessions.ts`에서 growth 연동 제거**

`import { applySessionToGrowth } from '../services/growth';` 줄을 삭제하고, `/:id/end` 핸들러의 `await applySessionToGrowth(req.userId!, verifiedSeconds);` 줄을 삭제한다(그 다음 줄 `res.json({ verifiedSeconds });`는 그대로 둔다).

- [ ] **Step 7: `backend/src/constants.ts`에서 decay/stage 상수 제거**

```ts
export const HEARTBEAT_INTERVAL_SECONDS = 30;
export const MAX_GAP_SECONDS = 300; // 5분 이상 끊기면 그 이후는 인증 안 함
```

(`DECAY_START_DAYS`, `DECAY_RATE`, `STAGE_THRESHOLDS`를 삭제 — 더 이상 어디서도 참조하지 않는다.)

- [ ] **Step 8: 전체 테스트 스위트 실행해 정리가 깨끗한지 확인**

Run: `cd backend && npm test`
Expected: PASS (growth/decay 관련 테스트는 삭제되어 더 이상 존재하지 않고, `sessions.test.ts`를 포함한 나머지는 그대로 통과해야 한다).

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/app.ts backend/src/cron.ts backend/src/routes/sessions.ts backend/src/constants.ts
git add -u backend/src/services backend/src/routes backend/src/jobs
git commit -m "refactor: remove time-gauge Growth/decay system, add Task/GrowthProfile schema"
```

---

## Task 2: 할일 생성 API (`POST /api/tasks`)

**Files:**
- Create: `backend/src/routes/tasks.ts`
- Test: `backend/src/routes/tasks.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `requireAuth`, `AuthedRequest` from `../middleware/auth`; `isNonEmptyString` from `./auth`; `prisma` from `../db`; `Category`, `Difficulty` from `@prisma/client` (Task 1에서 추가됨).
- Produces: `computeDueAt(dueChoice: 'TODAY' | 'THIS_WEEK', now: Date): Date`, `DIFFICULTY_XP: Record<Difficulty, number>` — Task 3~5에서 같은 라우터 파일에 계속 추가하므로 이 시그니처를 그대로 유지한다. `POST /api/tasks` 응답은 생성된 `Task` 레코드(JSON) 그대로.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/tasks.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { computeDueAt } from './tasks';

async function signup(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return res.body.token as string;
}

describe('computeDueAt', () => {
  it('returns today 23:59:59.999 for TODAY', () => {
    const now = new Date(2024, 0, 3, 10, 30, 0); // Wed Jan 3 2024
    const due = computeDueAt('TODAY', now);
    expect(due.getFullYear()).toBe(2024);
    expect(due.getMonth()).toBe(0);
    expect(due.getDate()).toBe(3);
    expect(due.getHours()).toBe(23);
    expect(due.getMinutes()).toBe(59);
  });

  it('returns this Sunday 23:59:59.999 for THIS_WEEK', () => {
    const now = new Date(2024, 0, 1, 10, 0, 0); // Mon Jan 1 2024
    const due = computeDueAt('THIS_WEEK', now);
    expect(due.getDate()).toBe(7); // Sunday Jan 7 2024
    expect(due.getHours()).toBe(23);
  });

  it('THIS_WEEK on a Sunday returns the same day', () => {
    const now = new Date(2024, 0, 7, 10, 0, 0); // Sun Jan 7 2024
    const due = computeDueAt('THIS_WEEK', now);
    expect(due.getDate()).toBe(7);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with XP mapped from difficulty', async () => {
    const token = await signup('taskcreate1@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '리스닝 20분', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('리스닝 20분');
    expect(res.body.xpValue).toBe(20);
    expect(res.body.status).toBe('PENDING');
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a missing title', async () => {
    const token = await signup('taskcreate2@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid difficulty', async () => {
    const token = await signup('taskcreate3@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', category: 'STUDY', difficulty: 'IMPOSSIBLE', dueChoice: 'TODAY' });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: FAIL with "Cannot find module './tasks'" (파일이 아직 없음)

- [ ] **Step 3: 최소 구현 작성**

`backend/src/routes/tasks.ts`:
```ts
import { Router } from 'express';
import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 35,
};

export function computeDueAt(dueChoice: 'TODAY' | 'THIS_WEEK', now: Date): Date {
  const due = new Date(now);
  if (dueChoice === 'THIS_WEEK') {
    const day = due.getDay(); // 0 = Sunday
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    due.setDate(due.getDate() + daysUntilSunday);
  }
  due.setHours(23, 59, 59, 999);
  return due;
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (Object.values(Difficulty) as string[]).includes(value);
}

function isDueChoice(value: unknown): value is 'TODAY' | 'THIS_WEEK' {
  return value === 'TODAY' || value === 'THIS_WEEK';
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, category, difficulty, dueChoice } = req.body;
  if (!isNonEmptyString(title) || !isNonEmptyString(category) || !isNonEmptyString(difficulty) || !isNonEmptyString(dueChoice)) {
    return res.status(400).json({ error: 'title, category, difficulty and dueChoice are required' });
  }
  if (!isCategory(category)) {
    return res.status(400).json({ error: 'category must be one of ' + Object.values(Category).join(', ') });
  }
  if (!isDifficulty(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be one of ' + Object.values(Difficulty).join(', ') });
  }
  if (!isDueChoice(dueChoice)) {
    return res.status(400).json({ error: 'dueChoice must be TODAY or THIS_WEEK' });
  }
  try {
    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        title,
        category,
        difficulty,
        xpValue: DIFFICULTY_XP[difficulty],
        dueAt: computeDueAt(dueChoice, new Date()),
      },
    });
    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

`backend/src/app.ts`에 아래 두 줄을 추가한다(다른 라우터 import/use들 옆에):
```ts
import tasksRouter from './routes/tasks';
```
```ts
app.use('/api/tasks', tasksRouter);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts backend/src/app.ts
git commit -m "feat: add POST /api/tasks with difficulty-to-XP mapping"
```

---

## Task 3: 할일 목록 조회 + 기한 지남 자동 실패 (`GET /api/tasks`)

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Consumes: Task 2의 `router`, `prisma`, `requireAuth`.
- Produces: `GET /api/tasks` — 응답은 `Task[]`(JSON), 호출 시점에 기한이 지난 `PENDING` 항목은 `FAILED`로 갱신된 뒤 반환됨.

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/routes/tasks.test.ts`에 추가:
```ts
import { prisma } from '../db';

describe('GET /api/tasks', () => {
  it('lists only the authenticated user\'s tasks', async () => {
    const tokenA = await signup('tasklist1@example.com');
    const tokenB = await signup('tasklist2@example.com');
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A의 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'B의 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A의 할일');
  });

  it('flips overdue PENDING tasks to FAILED on read', async () => {
    const token = await signup('tasklist3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '지난 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.find((t: { id: string }) => t.id === overdue.id).status).toBe('FAILED');

    const stored = await prisma.task.findUnique({ where: { id: overdue.id } });
    expect(stored?.status).toBe('FAILED');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: FAIL — `GET /api/tasks` 라우트가 없어 404 반환 (assert 실패).

- [ ] **Step 3: 구현 추가**

`backend/src/routes/tasks.ts`의 `export default router;` 바로 위에 추가:
```ts
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const now = new Date();
    await prisma.task.updateMany({
      where: { userId: req.userId!, status: 'PENDING', dueAt: { lt: now } },
      data: { status: 'FAILED' },
    });
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "feat: add GET /api/tasks with lazy auto-fail of overdue tasks"
```

---

## Task 4: 할일 완료 API (`PATCH /api/tasks/:id/complete`)

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Produces: `PATCH /api/tasks/:id/complete` — 성공 시 200 + 갱신된 `Task`. 이미 완료/실패면 409. 기한이 지났으면 409 + DB status를 `FAILED`로 갱신. 존재하지 않거나 타인 소유면 404.

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/routes/tasks.test.ts`에 추가:
```ts
describe('PATCH /api/tasks/:id/complete', () => {
  it('completes a pending task before its deadline', async () => {
    const token = await signup('taskcomplete1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '완료할 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('rejects completing an already-completed task', async () => {
    const token = await signup('taskcomplete2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '두번 완료', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });
    await request(app).patch(`/api/tasks/${createRes.body.id}/complete`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('rejects completing an expired task and marks it FAILED', async () => {
    const token = await signup('taskcomplete3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '만료된 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app)
      .patch(`/api/tasks/${overdue.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('task expired');

    const stored = await prisma.task.findUnique({ where: { id: overdue.id } });
    expect(stored?.status).toBe('FAILED');
  });

  it('returns 404 for another user\'s task', async () => {
    const tokenA = await signup('taskcomplete4@example.com');
    const tokenB = await signup('taskcomplete5@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A 소유', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: FAIL — 라우트 없음(404 대신 다른 상태 코드 기대 실패).

- [ ] **Step 3: 구현 추가**

`backend/src/routes/tasks.ts`의 `export default router;` 바로 위에 추가:
```ts
router.patch('/:id/complete', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (task.status !== 'PENDING') {
      return res.status(409).json({ error: 'task is not pending' });
    }
    if (task.dueAt.getTime() < Date.now()) {
      await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED' } });
      return res.status(409).json({ error: 'task expired' });
    }
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "feat: add PATCH /api/tasks/:id/complete"
```

---

## Task 5: 할일 삭제 API (`DELETE /api/tasks/:id`)

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Produces: `DELETE /api/tasks/:id` — `PENDING`만 삭제 가능(204). 완료/실패된 건 400. 없거나 타인 소유면 404.

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/routes/tasks.test.ts`에 추가:
```ts
describe('DELETE /api/tasks/:id', () => {
  it('deletes a pending task', async () => {
    const token = await signup('taskdelete1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '지울 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stored = await prisma.task.findUnique({ where: { id: createRes.body.id } });
    expect(stored).toBeNull();
  });

  it('rejects deleting a completed task', async () => {
    const token = await signup('taskdelete2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '완료된 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });
    await request(app).patch(`/api/tasks/${createRes.body.id}/complete`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for another user\'s task', async () => {
    const tokenA = await signup('taskdelete3@example.com');
    const tokenB = await signup('taskdelete4@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'A 소유', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app)
      .delete(`/api/tasks/${createRes.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: FAIL — 라우트 없음.

- [ ] **Step 3: 구현 추가**

`backend/src/routes/tasks.ts`의 `export default router;` 바로 위에 추가:
```ts
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (task.status !== 'PENDING') {
      return res.status(400).json({ error: 'only pending tasks can be deleted' });
    }
    await prisma.task.delete({ where: { id: task.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "feat: add DELETE /api/tasks/:id"
```

---

## Task 6: 성장 계산 서비스 (XP 합계, 부화, 단계, 성격)

**Files:**
- Create: `backend/src/services/growth.ts`
- Test: `backend/src/services/growth.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db`; `Species` from `@prisma/client`.
- Produces (Task 7이 그대로 사용):
  - `getTotalXp(userId: string): Promise<number>`
  - `ensureHatched(userId: string, totalXp: number, rand?: () => number): Promise<Species | null>`
  - `getGrowthStageInfo(species: Species, totalXp: number): { stage: number; xpIntoStage: number; xpToNextStage: number }`
  - `computePersonality(userId: string): Promise<{ axisA: 'STEADY' | 'LOOSE'; axisB: 'EASYGOING' | 'LASTMINUTE'; type: string } | null>`
  - `SPECIES_STAGE_THRESHOLDS: Record<Species, number[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/services/growth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import {
  getTotalXp,
  ensureHatched,
  getGrowthStageInfo,
  computePersonality,
  SPECIES_STAGE_THRESHOLDS,
} from './growth';

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: 'x', nickname: '테스터' } });
}

describe('getTotalXp', () => {
  it('returns 0 when there are no completed tasks', async () => {
    const user = await makeUser('xp1@example.com');
    expect(await getTotalXp(user.id)).toBe(0);
  });

  it('sums only COMPLETED task XP, ignoring PENDING and FAILED', async () => {
    const user = await makeUser('xp2@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'a', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'b', category: 'ETC', difficulty: 'MEDIUM', xpValue: 20, status: 'COMPLETED', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'c', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'PENDING', dueAt: new Date() },
    });
    await prisma.task.create({
      data: { userId: user.id, title: 'd', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'FAILED', dueAt: new Date() },
    });
    expect(await getTotalXp(user.id)).toBe(30);
  });
});

describe('ensureHatched', () => {
  it('returns null when totalXp is 0', async () => {
    const user = await makeUser('hatch1@example.com');
    expect(await ensureHatched(user.id, 0)).toBeNull();
  });

  it('assigns a species deterministically via the injected rand function', async () => {
    const user = await makeUser('hatch2@example.com');
    const species = await ensureHatched(user.id, 10, () => 0);
    expect(species).toBe('SPECIES_A');
  });

  it('keeps the species fixed on subsequent calls even if rand changes', async () => {
    const user = await makeUser('hatch3@example.com');
    const first = await ensureHatched(user.id, 10, () => 0);
    const second = await ensureHatched(user.id, 50, () => 0.99);
    expect(second).toBe(first);
  });
});

describe('getGrowthStageInfo', () => {
  it('returns stage 0 with correct progress below the first threshold', () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS.SPECIES_A;
    const info = getGrowthStageInfo('SPECIES_A', 10);
    expect(info.stage).toBe(0);
    expect(info.xpIntoStage).toBe(10);
    expect(info.xpToNextStage).toBe(thresholds[1] - 10);
  });

  it('returns the max stage with 0 xpToNextStage once XP exceeds the last threshold', () => {
    const thresholds = SPECIES_STAGE_THRESHOLDS.SPECIES_A;
    const info = getGrowthStageInfo('SPECIES_A', thresholds[thresholds.length - 1] + 1000);
    expect(info.stage).toBe(thresholds.length - 1);
    expect(info.xpToNextStage).toBe(0);
  });
});

describe('computePersonality', () => {
  it('returns null when fewer than 3 completed+failed tasks exist', async () => {
    const user = await makeUser('personality1@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'a', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    expect(await computePersonality(user.id)).toBeNull();
  });

  it('classifies STEADY when completion rate is high', async () => {
    const user = await makeUser('personality2@example.com');
    for (let i = 0; i < 4; i++) {
      const createdAt = new Date(Date.now() - 10_000);
      const dueAt = new Date(Date.now() + 10_000);
      await prisma.task.create({
        data: { userId: user.id, title: `a${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt: new Date(createdAt.getTime() + 1) },
      });
    }
    await prisma.task.create({
      data: { userId: user.id, title: 'fail', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'FAILED', dueAt: new Date() },
    });
    const result = await computePersonality(user.id);
    expect(result?.axisA).toBe('STEADY');
  });

  it('classifies LOOSE when completion rate is low', async () => {
    const user = await makeUser('personality3@example.com');
    await prisma.task.create({
      data: { userId: user.id, title: 'ok', category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.task.create({
        data: { userId: user.id, title: `fail${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'FAILED', dueAt: new Date() },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisA).toBe('LOOSE');
  });

  it('classifies EASYGOING when tasks are completed early in their window', async () => {
    const user = await makeUser('personality4@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 100_000);
      const dueAt = new Date(Date.now() + 100_000);
      const completedAt = new Date(createdAt.getTime() + 1_000); // very early
      await prisma.task.create({
        data: { userId: user.id, title: `early${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisB).toBe('EASYGOING');
  });

  it('classifies LASTMINUTE when tasks are completed near their deadline', async () => {
    const user = await makeUser('personality5@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 100_000);
      const dueAt = new Date(Date.now() + 100_000);
      const completedAt = new Date(dueAt.getTime() - 1_000); // very late
      await prisma.task.create({
        data: { userId: user.id, title: `late${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt },
      });
    }
    const result = await computePersonality(user.id);
    expect(result?.axisB).toBe('LASTMINUTE');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/services/growth.test.ts`
Expected: FAIL with "Cannot find module './growth'"

- [ ] **Step 3: 구현 작성**

`backend/src/services/growth.ts`:
```ts
import { Species } from '@prisma/client';
import { prisma } from '../db';

export const SPECIES_STAGE_THRESHOLDS: Record<Species, number[]> = {
  SPECIES_A: [0, 50, 150, 400, 900],
  SPECIES_B: [0, 60, 180, 450, 1000],
  SPECIES_C: [0, 40, 130, 350, 800],
};

const SPECIES_LIST: Species[] = ['SPECIES_A', 'SPECIES_B', 'SPECIES_C'];

export async function getTotalXp(userId: string): Promise<number> {
  const result = await prisma.task.aggregate({
    where: { userId, status: 'COMPLETED' },
    _sum: { xpValue: true },
  });
  return result._sum.xpValue ?? 0;
}

export async function ensureHatched(
  userId: string,
  totalXp: number,
  rand: () => number = Math.random
): Promise<Species | null> {
  if (totalXp <= 0) return null;
  const profile = await prisma.growthProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  if (profile.species) return profile.species;
  const species = SPECIES_LIST[Math.floor(rand() * SPECIES_LIST.length)];
  const updated = await prisma.growthProfile.update({
    where: { userId },
    data: { species },
  });
  return updated.species;
}

export function getGrowthStageInfo(
  species: Species,
  totalXp: number
): { stage: number; xpIntoStage: number; xpToNextStage: number } {
  const thresholds = SPECIES_STAGE_THRESHOLDS[species];
  let stage = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (totalXp >= thresholds[i]) stage = i;
  }
  const xpIntoStage = totalXp - thresholds[stage];
  const nextThreshold = thresholds[stage + 1];
  const xpToNextStage = nextThreshold !== undefined ? nextThreshold - totalXp : 0;
  return { stage, xpIntoStage, xpToNextStage };
}

export interface Personality {
  axisA: 'STEADY' | 'LOOSE';
  axisB: 'EASYGOING' | 'LASTMINUTE';
  type: string;
}

export async function computePersonality(userId: string): Promise<Personality | null> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ['COMPLETED', 'FAILED'] } },
  });
  if (tasks.length < 3) return null;

  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const completionRate = completed.length / tasks.length;
  const axisA: Personality['axisA'] = completionRate >= 0.7 ? 'STEADY' : 'LOOSE';

  const early = completed.filter((t) => {
    if (!t.completedAt) return false;
    const totalWindow = t.dueAt.getTime() - t.createdAt.getTime();
    if (totalWindow <= 0) return true;
    const elapsed = t.completedAt.getTime() - t.createdAt.getTime();
    return elapsed <= totalWindow * 0.5;
  });
  const earlyRate = completed.length > 0 ? early.length / completed.length : 0;
  const axisB: Personality['axisB'] = earlyRate >= 0.5 ? 'EASYGOING' : 'LASTMINUTE';

  return { axisA, axisB, type: `${axisA}_${axisB}` };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/services/growth.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/growth.ts backend/src/services/growth.test.ts
git commit -m "feat: add XP/species-hatch/stage/personality growth service"
```

---

## Task 7: 성장 상태 조회 API (`GET /api/growth/me`)

**Files:**
- Create: `backend/src/routes/growth.ts`
- Test: `backend/src/routes/growth.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `getTotalXp`, `ensureHatched`, `getGrowthStageInfo`, `computePersonality` from `../services/growth` (Task 6).
- Produces: `GET /api/growth/me` — 응답 `{ totalXp, species, stage, xpIntoStage, xpToNextStage, personality }`. 부화 전(`totalXp <= 0`)이면 `species: null, stage: 0, xpIntoStage: 0, xpToNextStage: null`.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/growth.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function signup(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return { token: res.body.token as string, userId: JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString()).userId as string };
}

describe('GET /api/growth/me', () => {
  it('returns egg state for a brand new user', async () => {
    const { token } = await signup('growthme1@example.com');
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(0);
    expect(res.body.species).toBeNull();
    expect(res.body.stage).toBe(0);
    expect(res.body.personality).toBeNull();
  });

  it('reflects hatched species and stage after completed tasks', async () => {
    const { token, userId } = await signup('growthme2@example.com');
    await prisma.task.create({
      data: { userId, title: 'x', category: 'ETC', difficulty: 'HARD', xpValue: 35, status: 'COMPLETED', dueAt: new Date(), completedAt: new Date() },
    });
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalXp).toBe(35);
    expect(res.body.species).not.toBeNull();
    expect(typeof res.body.stage).toBe('number');
  });

  it('includes a personality type once enough history exists', async () => {
    const { token, userId } = await signup('growthme3@example.com');
    for (let i = 0; i < 3; i++) {
      const createdAt = new Date(Date.now() - 10_000);
      const dueAt = new Date(Date.now() + 10_000);
      await prisma.task.create({
        data: { userId, title: `t${i}`, category: 'ETC', difficulty: 'EASY', xpValue: 10, status: 'COMPLETED', createdAt, dueAt, completedAt: new Date(createdAt.getTime() + 1) },
      });
    }
    const res = await request(app).get('/api/growth/me').set('Authorization', `Bearer ${token}`);
    expect(res.body.personality).not.toBeNull();
    expect(res.body.personality.type).toBe('STEADY_EASYGOING');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/growth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/growth.test.ts`
Expected: FAIL — `/api/growth/me`가 아직 없어 404.

- [ ] **Step 3: 구현 작성**

`backend/src/routes/growth.ts`:
```ts
import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getTotalXp, ensureHatched, getGrowthStageInfo, computePersonality } from '../services/growth';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const totalXp = await getTotalXp(req.userId!);
    const species = await ensureHatched(req.userId!, totalXp);
    const personality = await computePersonality(req.userId!);

    if (!species) {
      return res.json({
        totalXp,
        species: null,
        stage: 0,
        xpIntoStage: 0,
        xpToNextStage: null,
        personality,
      });
    }

    const { stage, xpIntoStage, xpToNextStage } = getGrowthStageInfo(species, totalXp);
    res.json({ totalXp, species, stage, xpIntoStage, xpToNextStage, personality });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

`backend/src/app.ts`에 추가:
```ts
import growthRouter from './routes/growth';
```
```ts
app.use('/api/growth', growthRouter);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/growth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 백엔드 전체 스위트 실행**

Run: `cd backend && npm test`
Expected: PASS (모든 테스트, growth/tasks 포함)

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/growth.ts backend/src/routes/growth.test.ts backend/src/app.ts
git commit -m "feat: add GET /api/growth/me combining XP, species, stage and personality"
```

---

## Task 8: 모바일 API 클라이언트 (`tasks.ts`, `growth.ts`)

**Files:**
- Create: `mobile/src/api/tasks.ts`
- Test: `mobile/src/api/tasks.test.ts`
- Create: `mobile/src/api/growth.ts`
- Test: `mobile/src/api/growth.test.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./client` (서브프로젝트 1에서 이미 존재).
- Produces (Task 9~11이 그대로 사용):
  - `mobile/src/api/tasks.ts`: `Category`, `Difficulty`, `TaskStatus`, `DueChoice` 타입, `Task` interface `{ id, title, category, difficulty, xpValue, dueAt, status, completedAt, createdAt }`, `listTasks(): Promise<Task[]>`, `createTask(title, category, difficulty, dueChoice): Promise<Task>`, `completeTask(id): Promise<Task>`, `deleteTask(id): Promise<void>`.
  - `mobile/src/api/growth.ts`: `Species` 타입, `Personality` interface `{ axisA, axisB, type }`, `GrowthState` interface `{ totalXp, species: Species | null, stage, xpIntoStage, xpToNextStage: number | null, personality: Personality | null }`, `getGrowth(): Promise<GrowthState>`.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/api/tasks.test.ts`:
```ts
import { listTasks, createTask, completeTask, deleteTask } from './tasks';

describe('listTasks', () => {
  it('returns the parsed task list', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => [{ id: '1', title: 'a' }] })
    ) as unknown as typeof fetch;
    const tasks = await listTasks();
    expect(tasks).toEqual([{ id: '1', title: 'a' }]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(listTasks()).rejects.toThrow('할일 목록을 불러오지 못했어요');
  });
});

describe('createTask', () => {
  it('posts the task fields and returns the created task', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) })
    ) as unknown as typeof fetch;
    const task = await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY');
    expect(task.title).toBe('운동하기');
  });
});

describe('completeTask', () => {
  it('returns the updated task', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: '1', status: 'COMPLETED' }) })
    ) as unknown as typeof fetch;
    const task = await completeTask('1');
    expect(task.status).toBe('COMPLETED');
  });

  it('throws a specific message when the task has expired', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'task expired' }) })
    ) as unknown as typeof fetch;
    await expect(completeTask('1')).rejects.toThrow('이미 기한이 지났습니다');
  });

  it('throws a generic message for other failures', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
    ) as unknown as typeof fetch;
    await expect(completeTask('1')).rejects.toThrow('할일을 완료하지 못했어요');
  });
});

describe('deleteTask', () => {
  it('resolves when the response is ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(deleteTask('1')).resolves.toBeUndefined();
  });
});
```

`mobile/src/api/growth.test.ts`:
```ts
import { getGrowth } from './growth';

describe('getGrowth', () => {
  it('returns the parsed growth state', async () => {
    const body = { totalXp: 10, species: null, stage: 0, xpIntoStage: 0, xpToNextStage: null, personality: null };
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => body })) as unknown as typeof fetch;
    const growth = await getGrowth();
    expect(growth).toEqual(body);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(getGrowth()).rejects.toThrow('꾸미 정보를 불러오지 못했어요');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/api/tasks.test.ts src/api/growth.test.ts`
Expected: FAIL with "Cannot find module './tasks'" / "Cannot find module './growth'"

- [ ] **Step 3: 구현 작성**

`mobile/src/api/tasks.ts`:
```ts
import { apiFetch } from './client';

export type Category = 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type TaskStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type DueChoice = 'TODAY' | 'THIS_WEEK';

export interface Task {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  xpValue: number;
  dueAt: string;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

export async function listTasks(): Promise<Task[]> {
  const res = await apiFetch('/api/tasks');
  if (!res.ok) throw new Error('할일 목록을 불러오지 못했어요');
  return res.json();
}

export async function createTask(
  title: string,
  category: Category,
  difficulty: Difficulty,
  dueChoice: DueChoice
): Promise<Task> {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, category, difficulty, dueChoice }),
  });
  if (!res.ok) throw new Error('할일을 추가하지 못했어요');
  return res.json();
}

export async function completeTask(id: string): Promise<Task> {
  const res = await apiFetch(`/api/tasks/${id}/complete`, { method: 'PATCH' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    if (body.error === 'task expired') throw new Error('이미 기한이 지났습니다');
    throw new Error('할일을 완료하지 못했어요');
  }
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('할일을 삭제하지 못했어요');
}
```

`mobile/src/api/growth.ts`:
```ts
import { apiFetch } from './client';

export type Species = 'SPECIES_A' | 'SPECIES_B' | 'SPECIES_C';
export type PersonalityType =
  | 'STEADY_EASYGOING'
  | 'STEADY_LASTMINUTE'
  | 'LOOSE_EASYGOING'
  | 'LOOSE_LASTMINUTE';

export interface Personality {
  axisA: 'STEADY' | 'LOOSE';
  axisB: 'EASYGOING' | 'LASTMINUTE';
  type: PersonalityType;
}

export interface GrowthState {
  totalXp: number;
  species: Species | null;
  stage: number;
  xpIntoStage: number;
  xpToNextStage: number | null;
  personality: Personality | null;
}

export async function getGrowth(): Promise<GrowthState> {
  const res = await apiFetch('/api/growth/me');
  if (!res.ok) throw new Error('꾸미 정보를 불러오지 못했어요');
  return res.json();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/api/tasks.test.ts src/api/growth.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api/tasks.ts mobile/src/api/tasks.test.ts mobile/src/api/growth.ts mobile/src/api/growth.test.ts
git commit -m "feat: add mobile API client for tasks and growth"
```

---

## Task 9: 꾸미 표시 컴포넌트 + 정보 모달

**Files:**
- Create: `mobile/src/components/KkumiView.tsx`
- Test: `mobile/src/components/KkumiView.test.tsx`
- Create: `mobile/src/components/KkumiInfoModal.tsx`
- Test: `mobile/src/components/KkumiInfoModal.test.tsx`

**Interfaces:**
- Consumes: `Species`, `GrowthState`, `PersonalityType` from `../api/growth` (Task 8).
- Produces (Task 11이 사용): `<KkumiView species={Species | null} stage={number} />` (testID `kkumi-view`), `<KkumiInfoModal visible={boolean} onClose={() => void} growth={GrowthState} />` (testID `kkumi-info-modal`, `kkumi-species-label`, `kkumi-stage-label`, `kkumi-personality-label`, `kkumi-modal-close`).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/KkumiView.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import KkumiView from './KkumiView';

describe('KkumiView', () => {
  it('renders without a species (egg state)', () => {
    render(<KkumiView species={null} stage={0} />);
    expect(screen.getByTestId('kkumi-view')).toBeTruthy();
  });

  it('renders with a species and stage', () => {
    render(<KkumiView species="SPECIES_B" stage={2} />);
    expect(screen.getByTestId('kkumi-view')).toBeTruthy();
  });
});
```

`mobile/src/components/KkumiInfoModal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import KkumiInfoModal from './KkumiInfoModal';
import { GrowthState } from '../api/growth';

const eggGrowth: GrowthState = {
  totalXp: 0,
  species: null,
  stage: 0,
  xpIntoStage: 0,
  xpToNextStage: null,
  personality: null,
};

const grownGrowth: GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: { axisA: 'STEADY', axisB: 'EASYGOING', type: 'STEADY_EASYGOING' },
};

describe('KkumiInfoModal', () => {
  it('shows egg state and "성격 파악 중" when there is no personality data', () => {
    render(<KkumiInfoModal visible onClose={() => {}} growth={eggGrowth} />);
    expect(screen.getByTestId('kkumi-species-label')).toHaveTextContent('알');
    expect(screen.getByTestId('kkumi-personality-label')).toHaveTextContent('성격 파악 중');
  });

  it('shows the species, stage and personality label once grown', () => {
    render(<KkumiInfoModal visible onClose={() => {}} growth={grownGrowth} />);
    expect(screen.getByTestId('kkumi-stage-label')).toHaveTextContent('1단계');
    expect(screen.getByTestId('kkumi-personality-label')).not.toHaveTextContent('성격 파악 중');
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    render(<KkumiInfoModal visible onClose={onClose} growth={grownGrowth} />);
    fireEvent.press(screen.getByTestId('kkumi-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/components/KkumiView.test.tsx src/components/KkumiInfoModal.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 구현 작성**

`mobile/src/components/KkumiView.tsx`:
```tsx
import { View } from 'react-native';
import { Species } from '../api/growth';

const SPECIES_COLORS: Record<Species, string> = {
  SPECIES_A: '#FFAB91',
  SPECIES_B: '#90CAF9',
  SPECIES_C: '#CE93D8',
};

interface Props {
  species: Species | null;
  stage: number;
}

export default function KkumiView({ species, stage }: Props) {
  const size = 80 + stage * 20;
  const color = species ? SPECIES_COLORS[species] : '#F2D0A4';
  return (
    <View
      testID="kkumi-view"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}
```

`mobile/src/components/KkumiInfoModal.tsx`:
```tsx
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { GrowthState, PersonalityType, Species } from '../api/growth';

const SPECIES_LABEL: Record<Species, string> = {
  SPECIES_A: '종 A',
  SPECIES_B: '종 B',
  SPECIES_C: '종 C',
};

const PERSONALITY_LABEL: Record<PersonalityType, string> = {
  STEADY_EASYGOING: '꾸준하고 여유로운 편',
  STEADY_LASTMINUTE: '꾸준하지만 막판에 몰아치는 편',
  LOOSE_EASYGOING: '느슨하지만 여유로운 편',
  LOOSE_LASTMINUTE: '느슨하고 막판에 몰아치는 편',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  growth: GrowthState;
}

export default function KkumiInfoModal({ visible, onClose, growth }: Props) {
  const progressTotal = growth.xpIntoStage + (growth.xpToNextStage ?? 0);
  const progressRatio = progressTotal > 0 ? growth.xpIntoStage / progressTotal : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View testID="kkumi-info-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16 }}>
          <Text testID="kkumi-species-label">{growth.species ? SPECIES_LABEL[growth.species] : '알'}</Text>
          <Text testID="kkumi-stage-label">{`${growth.stage}단계`}</Text>
          <View style={{ height: 8, backgroundColor: '#eee', borderRadius: 4 }}>
            <View
              testID="kkumi-xp-bar-fill"
              style={{ width: `${Math.round(progressRatio * 100)}%`, height: 8, backgroundColor: '#6BC5B8', borderRadius: 4 }}
            />
          </View>
          <Text testID="kkumi-personality-label">
            {growth.personality ? PERSONALITY_LABEL[growth.personality.type] : '성격 파악 중...'}
          </Text>
          <TouchableOpacity testID="kkumi-modal-close" onPress={onClose}>
            <Text>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/components/KkumiView.test.tsx src/components/KkumiInfoModal.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/KkumiView.tsx mobile/src/components/KkumiView.test.tsx mobile/src/components/KkumiInfoModal.tsx mobile/src/components/KkumiInfoModal.test.tsx
git commit -m "feat: add KkumiView and KkumiInfoModal placeholder components"
```

---

## Task 10: 할일 시트 컴포넌트 (플로팅 버튼 + morph 애니메이션 + 목록 + 추가 폼)

**Files:**
- Create: `mobile/src/components/TaskSheet.tsx`
- Test: `mobile/src/components/TaskSheet.test.tsx`

**Interfaces:**
- Consumes: `Task`, `Category`, `Difficulty`, `DueChoice` from `../api/tasks` (Task 8).
- Produces (Task 11이 사용): `<TaskSheet tasks={Task[]} onComplete={(id: string) => void} onCreate={(title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) => void} />`. testID: `task-fab`(collapsed 버튼), `task-fab-count`(예 "2/4" 텍스트), `task-sheet-close`, `task-list`, `task-complete-<id>`, `new-task-title`, `category-<CODE>`, `difficulty-<CODE>`, `due-today`, `due-week`, `add-task-submit`.

접힌 상태(fab)와 펼쳐진 상태(목록+폼)는 `useState`로 즉시 전환되고, `Animated.timing`은 크기 보간에만 쓰인다 — 그래서 테스트는 애니메이션 완료를 기다릴 필요 없이 `fireEvent.press` 직후 바로 펼쳐진 콘텐츠를 조회할 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/TaskSheet.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import TaskSheet from './TaskSheet';
import { Task } from '../api/tasks';

const tasks: Task[] = [
  { id: '1', title: '운동하기', category: 'EXERCISE', difficulty: 'EASY', xpValue: 10, dueAt: new Date().toISOString(), status: 'PENDING', completedAt: null, createdAt: new Date().toISOString() },
  { id: '2', title: '독서 30분', category: 'READING', difficulty: 'MEDIUM', xpValue: 20, dueAt: new Date().toISOString(), status: 'COMPLETED', completedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
];

describe('TaskSheet', () => {
  it('shows the done/total count on the collapsed button', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    expect(screen.getByTestId('task-fab-count')).toHaveTextContent('1/2');
  });

  it('expands to show the task list when the button is pressed', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByTestId('task-list')).toBeTruthy();
    expect(screen.getByText(/운동하기/)).toBeTruthy();
  });

  it('calls onComplete with the task id when the complete button is pressed', () => {
    const onComplete = jest.fn();
    render(<TaskSheet tasks={tasks} onComplete={onComplete} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('calls onCreate with the form values on submit', () => {
    const onCreate = jest.fn();
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={onCreate} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '리스닝 20분');
    fireEvent.press(screen.getByTestId('category-STUDY'));
    fireEvent.press(screen.getByTestId('difficulty-HARD'));
    fireEvent.press(screen.getByTestId('due-week'));
    fireEvent.press(screen.getByTestId('add-task-submit'));
    expect(onCreate).toHaveBeenCalledWith('리스닝 20분', 'STUDY', 'HARD', 'THIS_WEEK');
  });

  it('closes back to the collapsed button', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-sheet-close'));
    expect(screen.getByTestId('task-fab')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/components/TaskSheet.test.tsx`
Expected: FAIL with "Cannot find module './TaskSheet'"

- [ ] **Step 3: 구현 작성**

`mobile/src/components/TaskSheet.tsx`:
```tsx
import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Animated, Easing } from 'react-native';
import { Task, Category, Difficulty, DueChoice } from '../api/tasks';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  onCreate: (title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) => void;
}

const CATEGORIES: Category[] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export default function TaskSheet({ tasks, onComplete, onCreate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('ETC');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [dueChoice, setDueChoice] = useState<DueChoice>('TODAY');
  const progress = useRef(new Animated.Value(0)).current;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  function handleCreate() {
    if (title.trim().length === 0) return;
    onCreate(title.trim(), category, difficulty, dueChoice);
    setTitle('');
  }

  const size = progress.interpolate({ inputRange: [0, 1], outputRange: [64, 320] });

  return (
    <Animated.View
      testID="task-sheet-container"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: size,
        height: size,
        borderRadius: 16,
        backgroundColor: '#fff',
        overflow: 'hidden',
      }}
    >
      {!expanded ? (
        <TouchableOpacity testID="task-fab" onPress={toggle} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text testID="task-fab-count">{`${done}/${total}`}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, padding: 12 }}>
          <TouchableOpacity testID="task-sheet-close" onPress={toggle}>
            <Text>닫기</Text>
          </TouchableOpacity>
          <ScrollView testID="task-list">
            {tasks.map((t) => (
              <View key={t.id}>
                <Text>{`${t.title} (+${t.xpValue}XP)`}</Text>
                {t.status === 'PENDING' ? (
                  <TouchableOpacity testID={`task-complete-${t.id}`} onPress={() => onComplete(t.id)}>
                    <Text>완료</Text>
                  </TouchableOpacity>
                ) : (
                  <Text testID={`task-status-${t.id}`}>{t.status === 'COMPLETED' ? '완료됨' : '실패'}</Text>
                )}
              </View>
            ))}
          </ScrollView>
          <TextInput testID="new-task-title" placeholder="할일 제목" value={title} onChangeText={setTitle} />
          <View testID="category-picker">
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} testID={`category-${c}`} onPress={() => setCategory(c)}>
                <Text>{c}{category === c ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View testID="difficulty-picker">
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity key={d} testID={`difficulty-${d}`} onPress={() => setDifficulty(d)}>
                <Text>{d}{difficulty === d ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View testID="due-choice-picker">
            <TouchableOpacity testID="due-today" onPress={() => setDueChoice('TODAY')}>
              <Text>오늘{dueChoice === 'TODAY' ? ' ✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="due-week" onPress={() => setDueChoice('THIS_WEEK')}>
              <Text>이번 주{dueChoice === 'THIS_WEEK' ? ' ✓' : ''}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="add-task-submit" onPress={handleCreate}>
            <Text>추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/components/TaskSheet.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/TaskSheet.tsx mobile/src/components/TaskSheet.test.tsx
git commit -m "feat: add TaskSheet component with morph animation, list and add form"
```

---

## Task 11: HomeScreen 통합 + RootNavigator 테스트 갱신

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Create: `mobile/src/screens/HomeScreen.test.tsx`
- Modify: `mobile/src/navigation/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `listTasks`, `createTask`, `completeTask` from `../api/tasks`; `getGrowth` from `../api/growth`; `KkumiView`, `KkumiInfoModal`, `TaskSheet` (Task 8~10).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/HomeScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from '../api/tasks';
import * as growthApi from '../api/growth';
import HomeScreen from './HomeScreen';

jest.mock('../api/tasks');
jest.mock('../api/growth');

const growthState: growthApi.GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: null,
};

const task: tasksApi.Task = {
  id: '1',
  title: '운동하기',
  category: 'EXERCISE',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  (tasksApi.listTasks as jest.Mock).mockResolvedValue([task]);
  (growthApi.getGrowth as jest.Mock).mockResolvedValue(growthState);
  (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...task, status: 'COMPLETED' });
  (tasksApi.createTask as jest.Mock).mockResolvedValue({ ...task, id: '2', title: '새 할일' });
});

describe('HomeScreen', () => {
  it('loads growth and tasks on mount and shows the kkumi', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
    expect(growthApi.getGrowth).toHaveBeenCalled();
    expect(tasksApi.listTasks).toHaveBeenCalled();
  });

  it('opens the info modal when the kkumi is tapped', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
    fireEvent.press(screen.getByTestId('kkumi-tap-target'));
    expect(screen.getByTestId('kkumi-species-label')).toBeTruthy();
  });

  it('completes a task from the sheet and refreshes growth', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(growthApi.getGrowth).toHaveBeenCalledTimes(2));
  });

  it('creates a task from the sheet form and refreshes the list', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '새 할일');
    fireEvent.press(screen.getByTestId('add-task-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('새 할일', 'ETC', 'EASY', 'TODAY')
    );
    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(2));
  });

  it('shows a retry button when the initial load fails, and reloads on press', async () => {
    (growthApi.getGrowth as jest.Mock).mockRejectedValueOnce(new Error('불러오지 못했어요'));
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('home-retry')).toBeTruthy());

    fireEvent.press(screen.getByTestId('home-retry'));
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
  });

  it('keeps the expired-task message visible after the post-failure refresh completes', async () => {
    (tasksApi.completeTask as jest.Mock).mockRejectedValueOnce(new Error('이미 기한이 지났습니다'));
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));

    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('home-error')).toHaveTextContent('이미 기한이 지났습니다');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/screens/HomeScreen.test.tsx`
Expected: FAIL — 현재 `HomeScreen`은 정적 placeholder 텍스트만 렌더링해 `kkumi-tap-target` 등을 찾지 못함.

- [ ] **Step 3: 구현 작성**

`mobile/src/screens/HomeScreen.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask } from '../api/tasks';
import { GrowthState, getGrowth } from '../api/growth';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import TaskSheet from '../components/TaskSheet';

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [taskList, growthState] = await Promise.all([listTasks(), getGrowth()]);
      setTasks(taskList);
      setGrowth(growthState);
    } catch {
      setError('불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleComplete(id: string) {
    let failureMessage = '';
    try {
      await completeTask(id);
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : '할일을 완료하지 못했어요';
    }
    // refresh() runs regardless of outcome so an expired task's auto-fail (flipped
    // server-side on the next GET /api/tasks) shows up immediately; refresh() clears
    // any stale error internally, so a failure message here must be set *after* it
    // returns or it would be wiped before ever rendering.
    await refresh();
    if (failureMessage) setError(failureMessage);
  }

  async function handleCreate(title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) {
    try {
      await createTask(title, category, difficulty, dueChoice);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF4EF' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {error ? <Text testID="home-error">{error}</Text> : null}
        {growth ? (
          <TouchableOpacity testID="kkumi-tap-target" onPress={() => setModalVisible(true)}>
            <KkumiView species={growth.species} stage={growth.stage} />
          </TouchableOpacity>
        ) : error ? (
          <TouchableOpacity testID="home-retry" onPress={() => refresh()}>
            <Text>다시 시도</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {growth ? (
        <KkumiInfoModal visible={modalVisible} onClose={() => setModalVisible(false)} growth={growth} />
      ) : null}
      <TaskSheet tasks={tasks} onComplete={handleComplete} onCreate={handleCreate} />
    </View>
  );
}
```

- [ ] **Step 4: `RootNavigator.test.tsx`를 새 `HomeScreen`에 맞게 갱신**

`RootNavigator.test.tsx`는 지금까지 `HomeScreen`의 placeholder 텍스트("홈 화면 준비 중입니다")를 확인했는데, 이제 그 텍스트가 사라지고 `HomeScreen`이 실제 `fetch`를 호출하게 된다. 두 번째 테스트를 아래로 교체한다:

```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import RootNavigator from './RootNavigator';

describe('RootNavigator', () => {
  it('shows the auth stack when there is no stored token', async () => {
    render(
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('그로우미')).toBeTruthy());
  });

  it('shows the main tabs when a token is stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('no network in this test'))) as unknown as typeof fetch;
    render(
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('히스토리')).toBeTruthy());
  });
});
```

(`히스토리` 탭 라벨은 `HomeScreen` 내용과 무관하게 `MainTabs`가 항상 렌더링하므로 안정적인 검증 대상이다. `globalThis.fetch`를 reject하도록 미리 설정해 `HomeScreen`의 `listTasks`/`getGrowth` 호출이 즉시 실패하고 `catch`로 처리되게 한다.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd mobile && npm test`
Expected: PASS (전체 모바일 스위트)

- [ ] **Step 6: `tsc` 타입 체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/HomeScreen.test.tsx mobile/src/navigation/RootNavigator.test.tsx
git commit -m "feat: wire HomeScreen to real task/growth data with kkumi and task sheet"
```
