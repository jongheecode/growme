# 미션 실행 화면 + 타이머 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 할일을 탭하면 그 태스크 전용 미션 실행 화면(Modal)이 열리고, 거기서 하트비트 검증 타이머를 시작/중지하며 집중 시간을 재고 완료 처리도 할 수 있게 한다.

**Architecture:** 기존 `Activity` 전용이던 `Session`(하트비트 검증 타이머, `staleSessionJob` 포함)에 nullable `taskId`를 추가해 `Task`에도 연결한다. 타이머는 XP/성장에 영향 없음 — 순수 기록용. 모바일은 `ReactionModal`/`KkumiInfoModal`과 같은 패턴(새 react-navigation 스택 없이 `HomeScreen`이 조건부로 띄우는 풀스크린 Modal)으로 `MissionModal`을 추가한다.

**Tech Stack:** 백엔드 Express+Prisma+vitest+supertest. 모바일 React Native(Expo)+jest+`@testing-library/react-native`.

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-07-20-mission-execution-timer-design.md` (커밋 5e1b023)
- 모든 커밋 메시지는 한글로 작성한다.
- 모든 신규 텍스트(버튼 라벨 등)는 기존 코드처럼 한글로 작성한다.
- 백엔드는 `cd backend && npm test`(vitest, 실제 Postgres 사용, mock DB 없음)로 검증한다. `growme-postgres` 컨테이너가 떠 있어야 한다(Docker Desktop 포함, 없으면 기동 필요).
- 모바일은 `cd mobile && npm test`(jest)로 검증한다.
- 각 태스크 끝에서 백엔드는 `npx tsc --noEmit`, 모바일도 `npx tsc --noEmit`이 클린해야 한다.
- 타이머는 XP/성장에 전혀 영향을 주지 않는다 — `verifiedSeconds`는 기록만 되고 어떤 성장 계산에도 쓰이지 않는다(스펙의 "Out of scope").
- 레거시 `activityId` 기반 세션 경로(`/api/activities`, 기존 `sessions.test.ts`의 activityId 테스트)는 그대로 유지, 동작을 바꾸지 않는다.

---

## Task 1: Prisma 스키마에 `Session.taskId` 추가

**Files:**
- Modify: `backend/prisma/schema.prisma` (`Session` 모델, `Task` 모델)

**Interfaces:**
- Produces: `Session.taskId: string | null`, `Session.task: Task | null`(관계), `Task.sessions: Session[]`(역참조) — Task 2가 `prisma.session.create({ data: { taskId, ... } })`로 이 필드를 쓴다.

- [ ] **Step 1: 스키마 수정**

`backend/prisma/schema.prisma`에서 `Session` 모델을 찾아 다음과 같이 수정한다(`activityId`/`activity`를 nullable로 바꾸고 `taskId`/`task`를 추가):

```prisma
model Session {
  id              String    @id @default(uuid())
  activityId      String?
  activity        Activity? @relation(fields: [activityId], references: [id])
  taskId          String?
  task            Task?     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  verifiedSeconds Int       @default(0)
  lastHeartbeatAt DateTime  @default(now())
  createdAt       DateTime  @default(now())
}
```

`Task` 모델(현재 `reactionShownAt DateTime?` 다음, `createdAt` 앞 또는 뒤 아무 곳)에 역참조 필드를 추가한다:

```prisma
model Task {
  id              String     @id @default(uuid())
  userId          String
  goalId          String?
  goal            Goal?      @relation(fields: [goalId], references: [id], onDelete: SetNull)
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  title           String
  category        Category
  difficulty      Difficulty
  xpValue         Int
  dueAt           DateTime
  status          TaskStatus @default(PENDING)
  completedAt     DateTime?
  reactionText    String?
  reactionShownAt DateTime?
  createdAt       DateTime   @default(now())
  sessions        Session[]
}
```

- [ ] **Step 2: 개발 DB와 테스트 DB에 스키마 반영 + 클라이언트 생성**

```bash
cd backend
npx prisma db push --skip-generate
npx cross-env DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --skip-generate
npx prisma generate
```

Expected: 두 `db push` 모두 "Your database is now in sync with your Prisma schema." 출력(이미 동기화된 상태면 "already in sync"), `generate`는 에러 없이 완료.

- [ ] **Step 3: 기존 테스트가 여전히 통과하는지 확인**

Run: `cd backend && npm test`
Expected: 기존 테스트 전부 PASS(새 필드는 전부 optional이라 기존 activityId 경로에 영향 없음).

- [ ] **Step 4: 커밋**

```bash
git add backend/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat: Session에 taskId 필드 추가

기존 Activity 전용이던 하트비트 검증 세션을 Task에도 연결할 수 있게 한다.
activityId는 nullable로 바꿔 하위호환 유지.
EOF
)"
```

---

## Task 2: `POST /api/sessions/start`에 `taskId` 경로 추가

**Files:**
- Modify: `backend/src/routes/sessions.ts:9-28`
- Test: `backend/src/routes/sessions.test.ts`

**Interfaces:**
- Consumes: `Session.taskId`(Task 1).
- Produces: `POST /api/sessions/start`가 `{ taskId }` 바디를 받아 `201 { id, startedAt }` | `404`(태스크 없음/타 유저 소유) | `409`(PENDING 아님) | `400`(activityId/taskId 둘 다 없거나 둘 다 있음)을 반환. 기존 `{ activityId }` 경로는 동작 그대로.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/sessions.test.ts` 상단, `setupUserAndActivity` 함수 다음에 헬퍼 추가:

```ts
async function setupUserAndTask() {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: `st${Date.now()}@example.com`,
    password: 'password123',
    nickname: '테스터',
  });
  const token = signupRes.body.token;
  const taskRes = await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '집중', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
  return { token, taskId: taskRes.body.id };
}
```

파일 끝(`describe('Session lifecycle', ...)` 블록 뒤)에 새 `describe` 블록 추가:

```ts
describe('Session lifecycle for tasks', () => {
  it('starts a session for a task', async () => {
    const { token, taskId } = await setupUserAndTask();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it("returns 404 for another user's task", async () => {
    const { taskId } = await setupUserAndTask();
    const signupRes2 = await request(app).post('/api/auth/signup').send({
      email: `st2${Date.now()}@example.com`,
      password: 'password123',
      nickname: '테스터2',
    });
    const token2 = signupRes2.body.token;
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token2}`)
      .send({ taskId });
    expect(res.status).toBe(404);
  });

  it('returns 409 for a non-pending task', async () => {
    const { token, taskId } = await setupUserAndTask();
    await prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED' } });
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId });
    expect(res.status).toBe(409);
  });

  it('returns 400 when neither activityId nor taskId is given', async () => {
    const { token } = await setupUserAndTask();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when both activityId and taskId are given', async () => {
    const { token, taskId } = await setupUserAndTask();
    const activityRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '집중', category: 'STUDY' });
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId: activityRes.body.id, taskId });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/routes/sessions.test.ts`
Expected: 새 5개 테스트 FAIL(현재 `taskId`만 보내면 `activityId` 필수 검증에 걸려 400이 나오거나, 존재하지 않는 activityId 취급으로 404가 나옴 — 기대값과 다름). 기존 4개(activityId 경로)는 계속 PASS.

- [ ] **Step 3: 최소 구현**

`backend/src/routes/sessions.ts`의 `router.post('/start', ...)` 핸들러(9~28번 줄)를 다음으로 교체:

```ts
router.post('/start', requireAuth, async (req: AuthedRequest, res) => {
  const { activityId, taskId } = req.body;
  const hasActivityId = isNonEmptyString(activityId);
  const hasTaskId = isNonEmptyString(taskId);
  if (hasActivityId === hasTaskId) {
    return res.status(400).json({ error: 'exactly one of activityId or taskId is required' });
  }
  try {
    if (hasTaskId) {
      const task = await prisma.task.findFirst({ where: { id: taskId, userId: req.userId! } });
      if (!task) {
        return res.status(404).json({ error: 'task not found' });
      }
      if (task.status !== 'PENDING') {
        return res.status(409).json({ error: 'task is not pending' });
      }
      const session = await prisma.session.create({
        data: { taskId, userId: req.userId!, lastHeartbeatAt: new Date() },
      });
      return res.status(201).json({ id: session.id, startedAt: session.startedAt });
    }
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId: req.userId!, deletedAt: null },
    });
    if (!activity) {
      return res.status(404).json({ error: 'activity not found' });
    }
    const session = await prisma.session.create({
      data: { activityId, userId: req.userId!, lastHeartbeatAt: new Date() },
    });
    res.status(201).json({ id: session.id, startedAt: session.startedAt });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/routes/sessions.test.ts`
Expected: 전부 PASS(기존 4개 + 새 5개 = 9개).

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS, tsc 에러 없음. 이 시점에서 백엔드 작업이 전부 끝난다.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/sessions.ts backend/src/routes/sessions.test.ts
git commit -m "$(cat <<'EOF'
feat: POST /api/sessions/start에 taskId 경로 추가

태스크 전용 미션 실행 화면의 타이머가 이 엔드포인트로 세션을 시작한다.
activityId 경로는 동작 그대로 유지.
EOF
)"
```

---

## Task 3: 모바일 `sessions.ts` API 클라이언트

**Files:**
- Create: `mobile/src/api/sessions.ts`

**Interfaces:**
- Produces: `startTaskSession(taskId: string): Promise<{ id: string; startedAt: string }>`, `sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }>`, `endSession(sessionId: string): Promise<{ verifiedSeconds: number }>` — Task 4(`MissionModal`)가 이 세 함수를 쓴다.

이 태스크는 `mobile/src/api/tasks.ts`/`goals.ts`와 같이 순수 함수 추가라 별도 단위 테스트 파일이 없다(레포에 `mobile/src/api/*.test.ts`가 없는 기존 컨벤션과 동일 — API 클라이언트는 화면/컴포넌트 테스트에서 `jest.mock`으로 간접 검증됨). `tsc --noEmit`과 Task 4의 `MissionModal` 테스트로 검증한다.

- [ ] **Step 1: `mobile/src/api/sessions.ts` 작성**

```ts
import { apiFetch } from './client';

export async function startTaskSession(taskId: string): Promise<{ id: string; startedAt: string }> {
  const res = await apiFetch('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) throw new Error('타이머를 시작하지 못했어요');
  return res.json();
}

export async function sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' });
  if (!res.ok) throw new Error('하트비트 전송에 실패했어요');
  return res.json();
}

export async function endSession(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  if (!res.ok) throw new Error('타이머를 종료하지 못했어요');
  return res.json();
}
```

- [ ] **Step 2: 타입체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/api/sessions.ts
git commit -m "$(cat <<'EOF'
feat: 모바일 세션(타이머) API 클라이언트 추가
EOF
)"
```

---

## Task 4: `MissionModal` 컴포넌트

**Files:**
- Create: `mobile/src/components/MissionModal.tsx`
- Test: `mobile/src/components/MissionModal.test.tsx`

**Interfaces:**
- Consumes: `startTaskSession`, `sendHeartbeat`, `endSession`(Task 3); `Task` type from `../api/tasks`.
- Produces: `MissionModal({ task, onClose, onComplete }: { task: Task | null; onClose: () => void; onComplete: (id: string) => void })` — Task 6(`HomeScreen`)가 이 컴포넌트를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/MissionModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import MissionModal from './MissionModal';
import { Task } from '../api/tasks';
import * as sessionsApi from '../api/sessions';

jest.mock('../api/sessions');

const pendingTask: Task = {
  id: '1',
  title: '리스닝 20분',
  category: 'STUDY',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: null,
  reactionText: null,
  reactionShownAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (sessionsApi.startTaskSession as jest.Mock).mockResolvedValue({ id: 'session-1', startedAt: new Date().toISOString() });
  (sessionsApi.sendHeartbeat as jest.Mock).mockResolvedValue({ verifiedSeconds: 0 });
  (sessionsApi.endSession as jest.Mock).mockResolvedValue({ verifiedSeconds: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MissionModal', () => {
  it('renders nothing when task is null', () => {
    render(<MissionModal task={null} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.queryByTestId('mission-modal')).toBeNull();
  });

  it('shows task title and a zeroed timer for a pending task', () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByTestId('mission-title')).toHaveTextContent('리스닝 20분');
    expect(screen.getByTestId('mission-timer')).toHaveTextContent('00:00');
  });

  it('starts the timer and ticks the elapsed display', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalledWith('1'));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('mission-timer')).toHaveTextContent('00:03');
  });

  it('sends a heartbeat every 30 seconds while the timer runs', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(sessionsApi.sendHeartbeat).toHaveBeenCalledWith('session-1');
  });

  it('stops the timer and ends the session', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(screen.getByTestId('mission-timer-stop')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-stop'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(screen.getByTestId('mission-timer-start')).toBeTruthy();
  });

  it('ends the running session and calls onComplete when completed', async () => {
    const onComplete = jest.fn();
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={onComplete} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-complete'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('calls onComplete without ending a session when the timer was never started', async () => {
    const onComplete = jest.fn();
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={onComplete} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-complete'));
    });
    expect(sessionsApi.endSession).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('ends the running session and calls onClose when closed', async () => {
    const onClose = jest.fn();
    render(<MissionModal task={pendingTask} onClose={onClose} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-close'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a status label without timer controls for a completed task', () => {
    render(<MissionModal task={{ ...pendingTask, status: 'COMPLETED' }} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByTestId('mission-status')).toHaveTextContent('완료됨');
    expect(screen.queryByTestId('mission-timer-start')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/components/MissionModal.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`mobile/src/components/MissionModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../api/tasks';
import { startTaskSession, sendHeartbeat, endSession } from '../api/sessions';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface Props {
  task: Task | null;
  onClose: () => void;
  onComplete: (id: string) => void;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MissionModal({ task, onClose, onComplete }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = null;
    setSessionId(null);
    setElapsedSeconds(0);
  }, [task?.id]);

  useEffect(() => {
    if (!sessionId) return;
    const tickId = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    const heartbeatId = setInterval(() => {
      sendHeartbeat(sessionId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(tickId);
      clearInterval(heartbeatId);
    };
  }, [sessionId]);

  if (!task) return null;

  async function stopTimerIfRunning() {
    const current = sessionIdRef.current;
    if (!current) return;
    sessionIdRef.current = null;
    setSessionId(null);
    try {
      await endSession(current);
    } catch {
      // best-effort — 실패해도 staleSessionJob이 결국 정리한다.
    }
  }

  async function handleStartTimer() {
    try {
      const session = await startTaskSession(task!.id);
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setElapsedSeconds(0);
    } catch {
      // 시작 실패 시 조용히 무시 — 버튼이 다시 눌릴 수 있는 상태로 남는다.
    }
  }

  async function handleComplete() {
    await stopTimerIfRunning();
    onComplete(task!.id);
  }

  async function handleClose() {
    await stopTimerIfRunning();
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View testID="mission-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '80%' }}>
          <Text testID="mission-title">{task.title}</Text>
          <Text testID="mission-meta">{`${task.category} · ${task.difficulty} · +${task.xpValue}XP`}</Text>
          {task.status === 'PENDING' ? (
            <>
              <Text testID="mission-timer">{formatElapsed(elapsedSeconds)}</Text>
              {sessionId ? (
                <TouchableOpacity testID="mission-timer-stop" onPress={stopTimerIfRunning}>
                  <Text>타이머 중지</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity testID="mission-timer-start" onPress={handleStartTimer}>
                  <Text>타이머 시작</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity testID="mission-complete" onPress={handleComplete}>
                <Text>완료</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text testID="mission-status">{task.status === 'COMPLETED' ? '완료됨' : '실패'}</Text>
          )}
          <TouchableOpacity testID="mission-close" onPress={handleClose}>
            <Text>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/components/MissionModal.test.tsx`
Expected: 전부 PASS(9개).

- [ ] **Step 5: 타입체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/components/MissionModal.tsx mobile/src/components/MissionModal.test.tsx
git commit -m "$(cat <<'EOF'
feat: 미션 실행 화면(MissionModal) 컴포넌트 추가

태스크별 타이머 시작/중지 + 경과시간 표시 + 완료/닫기. 비주얼은
플레이스홀더 — 최종 디자인은 사용자가 별도로 입힌다.
EOF
)"
```

---

## Task 5: `TaskSheet.tsx`에 태스크 행 탭 연결

**Files:**
- Modify: `mobile/src/components/TaskSheet.tsx`
- Test: `mobile/src/components/TaskSheet.test.tsx`

**Interfaces:**
- Produces: `TaskSheet` props에 `onOpenTask?: (task: Task) => void` 추가(기본값 no-op) — Task 6(`HomeScreen`)가 실제 값을 넘긴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/TaskSheet.test.tsx`의 마지막 `it` 다음(파일 끝, `});` 앞)에 추가:

```tsx
  it('opens a task when its row is tapped', () => {
    const onOpenTask = jest.fn();
    render(
      <TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} onOpenTask={onOpenTask} />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    expect(onOpenTask).toHaveBeenCalledWith(tasks[0]);
  });

  it('completing a task does not also trigger onOpenTask', () => {
    const onComplete = jest.fn();
    const onOpenTask = jest.fn();
    render(
      <TaskSheet tasks={tasks} onComplete={onComplete} onCreate={() => {}} onOpenTask={onOpenTask} />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    expect(onComplete).toHaveBeenCalledWith('1');
    expect(onOpenTask).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/components/TaskSheet.test.tsx`
Expected: 새 2개 테스트 중 첫 번째 FAIL(`task-row-1`이라는 testID가 없음). 두 번째는 이미 우연히 통과할 수 있음(onOpenTask가 아직 호출될 방법이 없으므로) — 상관없다, Step 3 이후 둘 다 의미 있게 통과하는지가 중요하다.

- [ ] **Step 3: 최소 구현**

`mobile/src/components/TaskSheet.tsx`의 `Props` 인터페이스에 추가:

```ts
  onOpenTask?: (task: Task) => void;
```

함수 파라미터 구조분해에 기본값과 함께 추가:

```ts
  onOpenTask = () => {},
```

태스크 목록 렌더링 부분(`{tasks.map((t) => (` 블록)을 다음으로 교체:

```tsx
            {tasks.map((t) => (
              <TouchableOpacity key={t.id} testID={`task-row-${t.id}`} onPress={() => onOpenTask(t)}>
                <Text>{`${t.title} (+${t.xpValue}XP)`}</Text>
                {t.status === 'PENDING' ? (
                  <TouchableOpacity testID={`task-complete-${t.id}`} onPress={() => onComplete(t.id)}>
                    <Text>완료</Text>
                  </TouchableOpacity>
                ) : (
                  <Text testID={`task-status-${t.id}`}>{t.status === 'COMPLETED' ? '완료됨' : '실패'}</Text>
                )}
              </TouchableOpacity>
            ))}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/components/TaskSheet.test.tsx`
Expected: 전부 PASS(기존 9개 + 새 2개 = 11개).

- [ ] **Step 5: 타입체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/components/TaskSheet.tsx mobile/src/components/TaskSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat: TaskSheet 태스크 행 탭으로 미션 실행 화면을 열 수 있게 연결
EOF
)"
```

---

## Task 6: `HomeScreen.tsx` — `MissionModal` 연결

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Test: `mobile/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `MissionModal`(Task 4); `TaskSheet`의 `onOpenTask`(Task 5).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/HomeScreen.test.tsx` 상단 mock 블록(`jest.mock('../api/goals');` 다음 줄)에 추가:

```ts
jest.mock('../api/sessions');
```

파일 끝, 마지막 `it` 다음에 추가:

```ts
  it('opens the mission modal when a task row is tapped', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    expect(screen.getByTestId('mission-modal')).toBeTruthy();
  });

  it('closes the mission modal without completing the task', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    fireEvent.press(screen.getByTestId('mission-close'));
    expect(screen.queryByTestId('mission-modal')).toBeNull();
    expect(tasksApi.completeTask).not.toHaveBeenCalled();
  });

  it('completes a task from the mission modal and shows the reaction', async () => {
    (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED', reactionText: '잘했어!' });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    fireEvent.press(screen.getByTestId('mission-complete'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('잘했어!'));
    expect(screen.queryByTestId('mission-modal')).toBeNull();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/screens/HomeScreen.test.tsx`
Expected: 새 3개 테스트 FAIL(`task-row-1`을 눌러도 `mission-modal`이 뜨지 않음).

- [ ] **Step 3: 최소 구현**

`mobile/src/screens/HomeScreen.tsx`의 import 목록에 추가:

```ts
import MissionModal from '../components/MissionModal';
```

`HomeScreen` 함수 안, 다른 `useState` 선언 옆에 추가:

```ts
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
```

`<TaskSheet ...>`에 prop 추가:

```tsx
        onOpenTask={(t) => setSelectedTask(t)}
```

`<TaskSheet ...>` 바로 위(또는 아래, 같은 레벨)에 렌더링 추가:

```tsx
      <MissionModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onComplete={(id) => {
          setSelectedTask(null);
          handleComplete(id);
        }}
      />
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/screens/HomeScreen.test.tsx`
Expected: 전부 PASS(기존 14개 + 새 3개 = 17개).

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: 전부 PASS. 이 시점에서 서브프로젝트 5 구현이 전부 끝난다.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/HomeScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat: HomeScreen에 미션 실행 화면(타이머) 연결

태스크 행을 탭하면 MissionModal이 열리고, 거기서 완료하면 기존 리액션
흐름으로 자연스럽게 이어진다.
EOF
)"
```

---

## Task 7: 최종 회귀 테스트

- [ ] **전체 회귀 테스트**

Run:
```bash
cd backend && npm test && npx tsc --noEmit
cd ../mobile && npm test && npx tsc --noEmit
```

Expected: 백엔드/모바일 모두 전체 테스트 그린, `tsc --noEmit` 클린. 이걸로 서브프로젝트 5(미션 실행 화면 + 타이머)가 `docs/superpowers/specs/2026-07-20-mission-execution-timer-design.md`에 정의된 범위대로 전부 구현된 상태다.
