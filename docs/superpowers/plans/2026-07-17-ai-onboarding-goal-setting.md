# AI 온보딩 대화 + 목표 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 후 목표가 없는 사용자는 꾸미와의 자유 대화(Claude API + tool-use)로 목표(Goal)를 설정하고, 이후 프로필에서 언제든 새 목표를 추가하며, 홈 화면에서 목표를 전환해 그 목표의 할일만 볼 수 있게 한다.

**Architecture:** 백엔드에 `Goal` Prisma 모델과 상태 없는(stateless) `/api/goals/chat` 엔드포인트를 추가한다 — 모바일이 전체 대화 이력을 매번 보내면 백엔드가 Claude Messages API를 `set_goal` 도구와 함께 호출하고, 도구 호출이 오면 그 자리에서 `Goal`을 생성한다. 대화 내용 자체는 저장하지 않는다. `Task`에 옵셔널 `goalId`를 추가해 할일을 목표에 묶는다. 모바일은 `GoalsContext`(새 컨텍스트, `AuthContext`와 같은 패턴)로 목표 목록/활성 목표/"새 목표 추가 중" 상태를 관리하고, `RootNavigator`가 토큰·목표 유무·추가-중 여부 3가지 조건으로 화면을 분기한다.

**Tech Stack:** Express + Prisma(PostgreSQL) + vitest + supertest(백엔드, 기존 스택), 새 의존성 `@anthropic-ai/sdk`(백엔드 전용). Expo(React Native, TypeScript) + jest-expo + @testing-library/react-native(모바일, 기존 스택 그대로) — 모바일은 새 라이브러리 추가 없음.

## Global Constraints

- 기존 인증·타이머·XP 시스템(서브프로젝트 1·2)을 변경하지 않는다.
- 대화 메시지는 DB에 저장하지 않는다 — `Goal` 레코드만 결과로 남는다.
- `@anthropic-ai/sdk`는 백엔드에만 추가한다 — 모바일은 새 라이브러리 추가 없이 기존 `apiFetch` 패턴을 재사용한다.
- 목표는 오직 AI 대화(`set_goal` 도구 호출)를 통해서만 생성된다 — 수동 입력 폼은 이번 범위 밖.
- 백엔드 테스트(`cd backend && npm test`)는 실제 PostgreSQL(Docker `growme-postgres`)에 연결한다 — Claude API 호출은 `@anthropic-ai/sdk`를 모킹해 실제 네트워크 호출 없이 테스트한다.
- Claude 모델은 `claude-sonnet-5`를 사용한다.

---

## Task 1: Goal 스키마 추가 + Task.goalId

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma 모델 `Goal { id, userId, title, category(Category), createdAt }`, `Task.goalId String?`(nullable FK → `Goal`, `onDelete: SetNull`), `User.goals Goal[]`. 이후 모든 태스크가 이 필드/모델명을 그대로 사용한다.

이 태스크는 스키마 작업이라 TDD 사이클 대신 "기존 스위트가 깨지지 않는지 확인"으로 검증한다. `backend/tests/setup.ts:14`의 `TRUNCATE "Session","Activity","User" CASCADE`는 `Goal`이 `User`를 FK로 참조(`onDelete: Cascade`)하므로 별도 수정 없이 자동으로 함께 정리된다.

- [ ] **Step 1: `backend/prisma/schema.prisma`에 `Goal` 모델 추가, `Task`/`User` 수정**

`Category` enum 근처(파일 끝 부분)에 추가:
```prisma
model Goal {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  category  Category
  createdAt DateTime @default(now())
  tasks     Task[]
}
```

`User` 모델의 관계 필드 목록에 추가:
```prisma
  goals Goal[]
```

`Task` 모델에 `userId` 줄 바로 아래 추가:
```prisma
  goalId      String?
  goal        Goal?      @relation(fields: [goalId], references: [id], onDelete: SetNull)
```

- [ ] **Step 2: Prisma Client 재생성 + dev DB에 반영**

Run:
```bash
cd backend
npx prisma generate
npx prisma db push
```
Expected: 둘 다 에러 없이 완료.

- [ ] **Step 3: 전체 테스트 스위트 실행해 스키마 변경이 깨끗한지 확인**

Run: `cd backend && npm test`
Expected: PASS — `tests/setup.ts`의 `beforeAll`이 테스트 DB에도 자동으로 `prisma db push`를 실행하므로 별도 조치 없이 기존 74개 테스트가 그대로 통과해야 한다.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add Goal model and Task.goalId to schema"
```

---

## Task 2: 목표 목록 조회 API (`GET /api/goals`)

**Files:**
- Create: `backend/src/routes/goals.ts`
- Test: `backend/src/routes/goals.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `requireAuth`, `AuthedRequest` from `../middleware/auth`; `prisma` from `../db`.
- Produces: `GET /api/goals` — 응답은 `Goal[]`(JSON, 최신순). Task 3이 같은 라우터 파일에 `POST /chat`을 추가하므로 파일 구조를 유지한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/goals.test.ts`:
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
  return res.body.token as string;
}

describe('GET /api/goals', () => {
  it("returns the authenticated user's goals, newest first", async () => {
    const token = await signup('goalslist1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.goal.create({ data: { userId: decoded.userId, title: '첫 목표', category: 'STUDY' } });
    await prisma.goal.create({ data: { userId: decoded.userId, title: '두번째 목표', category: 'EXERCISE' } });

    const res = await request(app).get('/api/goals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('두번째 목표');
  });

  it("does not return another user's goals", async () => {
    const tokenA = await signup('goalslist2@example.com');
    const tokenB = await signup('goalslist3@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    await prisma.goal.create({ data: { userId: decodedA.userId, title: 'A의 목표', category: 'STUDY' } });

    const res = await request(app).get('/api/goals').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/goals.test.ts`
Expected: FAIL with "Cannot find module '../app'" 관련 실패가 아니라, `/api/goals`가 404를 반환해 assert 실패(라우트가 아직 없음).

- [ ] **Step 3: 최소 구현 작성**

`backend/src/routes/goals.ts`:
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(goals);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

`backend/src/app.ts`에 추가:
```ts
import goalsRouter from './routes/goals';
```
```ts
app.use('/api/goals', goalsRouter);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/goals.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/goals.ts backend/src/routes/goals.test.ts backend/src/app.ts
git commit -m "feat: add GET /api/goals"
```

---

## Task 3: 목표 설정 대화 API (`POST /api/goals/chat`)

**Files:**
- Create: `backend/src/services/goalChat.ts`
- Test: `backend/src/services/goalChat.test.ts`
- Modify: `backend/src/routes/goals.ts`
- Modify: `backend/src/routes/goals.test.ts`
- Modify: `backend/.env`, `backend/.env.example`
- Modify: `backend/package.json`(의존성 추가)

**Interfaces:**
- Consumes: `Category` from `@prisma/client`; `prisma` from `../db`(라우트에서); `isNonEmptyString`는 이번엔 쓰지 않음(별도 배열 검증 함수 사용).
- Produces: `backend/src/services/goalChat.ts`의 `runGoalChat(messages: ChatMessage[]): Promise<GoalChatResult>`(`ChatMessage = { role: 'user' | 'assistant'; content: string }`, `GoalChatResult = { reply: string; goalInput: { title: string; category: Category } | null }`) — 이후 라우트가 그대로 사용. `POST /api/goals/chat` 응답: `{ reply, goalSet: false }` 또는 `{ reply, goalSet: true, goal: Goal }`.

- [ ] **Step 1: `@anthropic-ai/sdk` 설치 + 환경변수 등록**

Run:
```bash
cd backend
npm install @anthropic-ai/sdk
```
Expected: `package.json`의 `dependencies`에 `@anthropic-ai/sdk`가 추가됨.

`backend/.env.example`에 한 줄 추가:
```
ANTHROPIC_API_KEY=""
```

`backend/.env`에도 같은 줄을 추가한다(실제 키는 사용자가 직접 발급해 채워야 하며, 이 파일은 git에 커밋되지 않는다 — 키가 비어 있어도 이번 태스크의 자동 테스트는 Anthropic SDK를 모킹하므로 영향받지 않는다. 실제 대화 기능을 수동으로 확인하려면 https://console.anthropic.com 에서 발급한 키를 채워야 한다).

- [ ] **Step 2: 실패하는 서비스 테스트 작성**

`backend/src/services/goalChat.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { runGoalChat } from './goalChat';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('runGoalChat', () => {
  it('returns goalInput:null for a plain text reply', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '요즘 어떤 게 고민이야?' }],
    });
    const result = await runGoalChat([{ role: 'user', content: '안녕' }]);
    expect(result.reply).toBe('요즘 어떤 게 고민이야?');
    expect(result.goalInput).toBeNull();
  });

  it('extracts the goal when the model calls set_goal with valid input', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: '좋아, 목표를 정했어!' },
        { type: 'tool_use', name: 'set_goal', input: { title: '매일 영어 리스닝', category: 'STUDY' } },
      ],
    });
    const result = await runGoalChat([{ role: 'user', content: '영어 공부 습관 만들고 싶어' }]);
    expect(result.reply).toBe('좋아, 목표를 정했어!');
    expect(result.goalInput).toEqual({ title: '매일 영어 리스닝', category: 'STUDY' });
  });

  it('ignores a tool call with an invalid category', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { title: 'x', category: 'NOT_REAL' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.goalInput).toBeNull();
  });

  it('ignores a tool call with a missing title', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { category: 'STUDY' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.goalInput).toBeNull();
  });

  it('falls back to a default reply when there is no text block alongside a tool call', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { title: '독서 습관', category: 'READING' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.goalInput).toEqual({ title: '독서 습관', category: 'READING' });
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(runGoalChat([{ role: 'user', content: 'x' }])).rejects.toThrow('rate limited');
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/services/goalChat.test.ts`
Expected: FAIL with "Cannot find module './goalChat'"

- [ ] **Step 4: 서비스 구현 작성**

`backend/src/services/goalChat.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import { Category } from '@prisma/client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const SYSTEM_PROMPT = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자가 앱을 처음 켰거나 새 목표를 정하고 싶을 때 자연스러운 대화로 말을 걸어. 형식적인 질문지처럼 묻지 말고, 친구처럼 편하게 이야기를 나누면서 사용자가 요즘 관심 있어 하는 일이나 이루고 싶은 것을 자연스럽게 끌어내. 대화 중 사용자의 목표가 실행 가능한 수준으로 구체적이라고 판단되면(예: "매일 영어 리스닝 습관 만들기") set_goal 도구를 호출해서 목표를 확정해. 목표가 너무 막연하면(예: "그냥 잘 살고 싶어") 도구를 호출하지 말고 좀 더 구체적으로 물어봐.`;

export const SET_GOAL_TOOL = {
  name: 'set_goal',
  description: '대화에서 사용자의 목표가 충분히 구체적으로 드러났을 때 호출한다',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' as const },
      category: { type: 'string' as const, enum: ['EXERCISE', 'STUDY', 'READING', 'ETC'] },
    },
    required: ['title', 'category'],
  },
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GoalChatResult {
  reply: string;
  goalInput: { title: string; category: Category } | null;
}

function isValidCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

export async function runGoalChat(messages: ChatMessage[]): Promise<GoalChatResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SET_GOAL_TOOL],
    messages,
  });

  const content = response.content as Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  const textBlock = content.find((b) => b.type === 'text');
  const toolBlock = content.find((b) => b.type === 'tool_use' && b.name === 'set_goal');

  const reply = textBlock?.text ?? '좋아, 목표를 정했어!';

  if (toolBlock) {
    const input = toolBlock.input as { title?: unknown; category?: unknown };
    if (typeof input.title === 'string' && input.title.length > 0 && isValidCategory(input.category)) {
      return { reply, goalInput: { title: input.title, category: input.category } };
    }
  }

  return { reply, goalInput: null };
}
```

- [ ] **Step 5: 서비스 테스트 통과 확인**

Run: `cd backend && npm test -- src/services/goalChat.test.ts`
Expected: PASS (6 tests). `tsc` 관련 타입 에러가 나면(설치된 `@anthropic-ai/sdk` 버전의 타입 정의 차이로) `messages.create`의 `tools`/`messages` 인자에 필요한 최소한의 타입 캐스트만 추가해 해결한다 — 로직 자체는 바꾸지 않는다.

- [ ] **Step 6: 라우트에 대한 실패하는 테스트 추가**

`backend/src/routes/goals.test.ts`에 추가:
```ts
import { vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe('POST /api/goals/chat', () => {
  it('returns a plain reply when no goal is set yet', async () => {
    const token = await signup('goalschat1@example.com');
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '요즘 어때?' }] });

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '안녕' }] });

    expect(res.status).toBe(200);
    expect(res.body.goalSet).toBe(false);
    expect(res.body.reply).toBe('요즘 어때?');
  });

  it('creates a Goal and returns it when the model calls set_goal', async () => {
    const token = await signup('goalschat2@example.com');
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: '좋아!' },
        { type: 'tool_use', name: 'set_goal', input: { title: '매일 달리기', category: 'EXERCISE' } },
      ],
    });

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '운동 습관 만들고 싶어' }] });

    expect(res.status).toBe(200);
    expect(res.body.goalSet).toBe(true);
    expect(res.body.goal.title).toBe('매일 달리기');

    const stored = await prisma.goal.findUnique({ where: { id: res.body.goal.id } });
    expect(stored).not.toBeNull();
  });

  it('returns 400 when messages is missing or malformed', async () => {
    const token = await signup('goalschat3@example.com');
    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 500 when the Anthropic call fails', async () => {
    const token = await signup('goalschat4@example.com');
    mockCreate.mockRejectedValue(new Error('rate limited'));

    const res = await request(app)
      .post('/api/goals/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: '안녕' }] });

    expect(res.status).toBe(500);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/goals/chat').send({ messages: [] });
    expect(res.status).toBe(401);
  });
});
```

(이 블록을 파일 맨 아래, 기존 `describe('GET /api/goals', ...)` 다음에 추가하고, 파일 상단의 `import` 구문들 옆에 `vi.hoisted`/`vi.mock` 블록을 추가한다. `vi`, `beforeEach`는 이미 vitest에서 import되어 있지 않다면 기존 `import { describe, it, expect } from 'vitest';`에 추가한다.)

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/goals.test.ts`
Expected: FAIL — `/api/goals/chat` 라우트가 아직 없어 404.

- [ ] **Step 8: 라우트 구현 추가**

`backend/src/routes/goals.ts`의 `export default router;` 바로 위에 추가:
```ts
import { runGoalChat, ChatMessage } from '../services/goalChat';
```
(이 import는 파일 맨 위, 기존 import들 옆으로 옮긴다.)

```ts
function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (v.role === 'user' || v.role === 'assistant') && typeof v.content === 'string';
}

router.post('/chat', requireAuth, async (req: AuthedRequest, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  try {
    const result = await runGoalChat(messages);
    if (result.goalInput) {
      const goal = await prisma.goal.create({
        data: { userId: req.userId!, title: result.goalInput.title, category: result.goalInput.category },
      });
      return res.json({ reply: result.reply, goalSet: true, goal });
    }
    res.json({ reply: result.reply, goalSet: false });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/goals.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 10: 백엔드 전체 스위트 실행**

Run: `cd backend && npm test`
Expected: PASS (모든 테스트, goals/goalChat 포함)

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.env.example backend/src/services/goalChat.ts backend/src/services/goalChat.test.ts backend/src/routes/goals.ts backend/src/routes/goals.test.ts
git commit -m "feat: add POST /api/goals/chat with Claude tool-use goal extraction"
```

(`.env`는 gitignore되어 있어 커밋 대상이 아니다.)

---

## Task 4: 할일 생성 시 목표 연결 (`POST /api/tasks`의 `goalId`)

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Produces: `POST /api/tasks`가 이제 옵셔널 `goalId`를 받는다. 유효한(본인 소유) 목표면 `Task.goalId`에 저장, 없으면 `null`. 존재하지 않거나 타인 소유면 400.

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/src/routes/tasks.test.ts`에 추가:
```ts
describe('POST /api/tasks with goalId', () => {
  it('attaches the task to the given goal when it belongs to the user', async () => {
    const token = await signup('taskgoal1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decoded.userId, title: '목표', category: 'STUDY' } });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: goal.id });

    expect(res.status).toBe(201);
    expect(res.body.goalId).toBe(goal.id);
  });

  it('rejects a goalId belonging to another user', async () => {
    const tokenA = await signup('taskgoal2@example.com');
    const tokenB = await signup('taskgoal3@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decodedA.userId, title: 'A의 목표', category: 'STUDY' } });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: goal.id });

    expect(res.status).toBe(400);
  });

  it('rejects a nonexistent goalId', async () => {
    const token = await signup('taskgoal4@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY', goalId: 'nonexistent-id' });
    expect(res.status).toBe(400);
  });

  it('creates a task without a goalId as before (backward compatible)', async () => {
    const token = await signup('taskgoal5@example.com');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });
    expect(res.status).toBe(201);
    expect(res.body.goalId).toBeNull();
  });
});
```

(파일 상단에 `import { prisma } from '../db';`가 이미 있는지 확인 — 없다면 추가한다.)

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: FAIL — 지금은 `goalId`를 무시하고 항상 `null`로 저장하므로 첫 번째 테스트가 실패, 나머지는 검증 로직이 없어 400 대신 201을 반환해 실패.

- [ ] **Step 3: 구현 수정**

`backend/src/routes/tasks.ts`의 `POST /` 핸들러를 아래로 교체:
```ts
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { title, category, difficulty, dueChoice, goalId } = req.body;
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
  if (goalId !== undefined && !isNonEmptyString(goalId)) {
    return res.status(400).json({ error: 'goalId must be a string' });
  }
  try {
    if (goalId) {
      const goal = await prisma.goal.findFirst({ where: { id: goalId, userId: req.userId! } });
      if (!goal) {
        return res.status(400).json({ error: 'invalid goalId' });
      }
    }
    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        goalId: goalId ?? null,
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npm test -- src/routes/tasks.test.ts`
Expected: PASS (20 tests)

- [ ] **Step 5: 백엔드 전체 스위트 실행**

Run: `cd backend && npm test`
Expected: PASS — 이것으로 백엔드 절반이 끝난다.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "feat: attach tasks to a goal via optional goalId"
```

---

## Task 5: 모바일 API 클라이언트 (`goals.ts` + `tasks.ts` 확장)

**Files:**
- Create: `mobile/src/api/goals.ts`
- Test: `mobile/src/api/goals.test.ts`
- Modify: `mobile/src/api/tasks.ts`
- Modify: `mobile/src/api/tasks.test.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./client`; `Category` from `./tasks`(goals.ts에서).
- Produces (Task 6~10이 사용): `mobile/src/api/goals.ts`의 `Goal { id, title, category, createdAt }`, `ChatMessage { role: 'user' | 'assistant'; content: string }`, `listGoals(): Promise<Goal[]>`, `sendGoalChatMessage(messages: ChatMessage[]): Promise<{ reply: string; goalSet: boolean; goal?: Goal }>`. `mobile/src/api/tasks.ts`의 `Task` interface에 `goalId: string | null` 필드 추가, `createTask(title, category, difficulty, dueChoice, goalId?: string): Promise<Task>`(다섯 번째 인자 추가).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/api/goals.test.ts`:
```ts
import { listGoals, sendGoalChatMessage } from './goals';

describe('listGoals', () => {
  it('returns the parsed goal list', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => [{ id: '1', title: '목표', category: 'STUDY', createdAt: 'x' }] })
    ) as unknown as typeof fetch;
    const goals = await listGoals();
    expect(goals).toEqual([{ id: '1', title: '목표', category: 'STUDY', createdAt: 'x' }]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(listGoals()).rejects.toThrow('목표 목록을 불러오지 못했어요');
  });
});

describe('sendGoalChatMessage', () => {
  it('returns the chat result on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ reply: '안녕!', goalSet: false }) })
    ) as unknown as typeof fetch;
    const result = await sendGoalChatMessage([{ role: 'user', content: '안녕' }]);
    expect(result.reply).toBe('안녕!');
    expect(result.goalSet).toBe(false);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(sendGoalChatMessage([{ role: 'user', content: 'x' }])).rejects.toThrow('메시지를 보내지 못했어요');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/api/goals.test.ts`
Expected: FAIL with "Cannot find module './goals'"

- [ ] **Step 3: `goals.ts` 구현 작성**

`mobile/src/api/goals.ts`:
```ts
import { apiFetch } from './client';
import { Category } from './tasks';

export interface Goal {
  id: string;
  title: string;
  category: Category;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  goalSet: boolean;
  goal?: Goal;
}

export async function listGoals(): Promise<Goal[]> {
  const res = await apiFetch('/api/goals');
  if (!res.ok) throw new Error('목표 목록을 불러오지 못했어요');
  return res.json();
}

export async function sendGoalChatMessage(messages: ChatMessage[]): Promise<ChatResult> {
  const res = await apiFetch('/api/goals/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error('메시지를 보내지 못했어요');
  return res.json();
}
```

- [ ] **Step 4: `goals.ts` 테스트 통과 확인**

Run: `cd mobile && npm test -- src/api/goals.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `tasks.ts`에 대한 실패하는 테스트 추가**

`mobile/src/api/tasks.test.ts`의 `describe('createTask', ...)` 다음에 추가:
```ts
describe('createTask with goalId', () => {
  it('includes goalId in the request body when provided', async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = jest.fn((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) });
    }) as unknown as typeof fetch;

    await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY', 'goal-1');
    expect(JSON.parse(capturedBody!).goalId).toBe('goal-1');
  });

  it('omits goalId from the request body when not provided', async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = jest.fn((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) });
    }) as unknown as typeof fetch;

    await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY');
    expect(JSON.parse(capturedBody!).goalId).toBeUndefined();
  });
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/api/tasks.test.ts`
Expected: FAIL — `createTask`가 5번째 인자를 받지 않아 타입 에러 또는 `goalId`가 항상 undefined.

- [ ] **Step 7: `tasks.ts` 수정**

`mobile/src/api/tasks.ts`의 `Task` interface에 `goalId` 필드 추가:
```ts
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
  goalId: string | null;
}
```

`createTask` 함수를 아래로 교체:
```ts
export async function createTask(
  title: string,
  category: Category,
  difficulty: Difficulty,
  dueChoice: DueChoice,
  goalId?: string
): Promise<Task> {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, category, difficulty, dueChoice, goalId }),
  });
  if (!res.ok) throw new Error('할일을 추가하지 못했어요');
  return res.json();
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/api/tasks.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 9: Commit**

```bash
git add mobile/src/api/goals.ts mobile/src/api/goals.test.ts mobile/src/api/tasks.ts mobile/src/api/tasks.test.ts
git commit -m "feat: add mobile API client for goals, extend createTask with goalId"
```

---

## Task 6: `GoalsContext`

**Files:**
- Create: `mobile/src/context/GoalsContext.tsx`
- Test: `mobile/src/context/GoalsContext.test.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: `Goal`, `listGoals` from `../api/goals`(Task 5); `useAuth` from `./AuthContext`.
- Produces (Task 7~10이 사용): `GoalsProvider`(컴포넌트), `useGoals()` 훅이 반환하는 `{ goals: Goal[], isLoading: boolean, error: string, activeGoalId: string | null, setActiveGoalId: (id: string) => void, isAddingGoal: boolean, startAddGoal: () => void, stopAddGoal: () => void, refreshGoals: () => Promise<void> }`. `refreshGoals`가 실패하면 기존 `goals` 값은 그대로 두고(비우지 않음) `error`만 채운다 — 목표가 이미 있던 사용자가 일시적 네트워크 오류로 목표 목록이 비어 보여 다시 온보딩 화면에 갇히는 것을 막기 위함.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/context/GoalsContext.test.tsx`:
```tsx
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from './AuthContext';
import { GoalsProvider, useGoals } from './GoalsContext';
import * as goalsApi from '../api/goals';

jest.mock('../api/goals');

function Probe() {
  const { goals, isLoading, error, activeGoalId, setActiveGoalId, isAddingGoal, startAddGoal, stopAddGoal, refreshGoals } =
    useGoals();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text testID="goal-count">{goals.length}</Text>
      <Text testID="active-goal">{activeGoalId ?? 'none'}</Text>
      <Text testID="adding">{isAddingGoal ? 'yes' : 'no'}</Text>
      <Text testID="goals-error">{error}</Text>
      <Text onPress={() => setActiveGoalId('g1')}>select-g1</Text>
      <Text onPress={() => startAddGoal()}>start-add</Text>
      <Text onPress={() => stopAddGoal()}>stop-add</Text>
      <Text onPress={() => refreshGoals()}>refresh</Text>
    </>
  );
}

const goalsList = [
  { id: 'g2', title: '두번째', category: 'STUDY' as const, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'g1', title: '첫번째', category: 'ETC' as const, createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('GoalsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (goalsApi.listGoals as jest.Mock).mockResolvedValue(goalsList);
  });

  it('loads goals and defaults activeGoalId to the newest goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    expect(screen.getByTestId('active-goal')).toHaveTextContent('g2');
  });

  it('setActiveGoalId changes the active goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    await act(async () => {
      screen.getByText('select-g1').props.onPress();
    });
    expect(screen.getByTestId('active-goal')).toHaveTextContent('g1');
  });

  it('startAddGoal/stopAddGoal toggle isAddingGoal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    await act(async () => {
      screen.getByText('start-add').props.onPress();
    });
    expect(screen.getByTestId('adding')).toHaveTextContent('yes');
    await act(async () => {
      screen.getByText('stop-add').props.onPress();
    });
    expect(screen.getByTestId('adding')).toHaveTextContent('no');
  });

  it('has no goals and does not call listGoals when there is no token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('0'));
    expect(goalsApi.listGoals).not.toHaveBeenCalled();
  });

  it('keeps the previously loaded goals and surfaces an error when a later refresh fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));

    (goalsApi.listGoals as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      screen.getByText('refresh').props.onPress();
    });

    expect(screen.getByTestId('goal-count')).toHaveTextContent('2');
    expect(screen.getByTestId('goals-error')).toHaveTextContent('목표 목록을 불러오지 못했어요');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/context/GoalsContext.test.tsx`
Expected: FAIL with "Cannot find module './GoalsContext'"

- [ ] **Step 3: 구현 작성**

`mobile/src/context/GoalsContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Goal, listGoals } from '../api/goals';
import { useAuth } from './AuthContext';

interface GoalsState {
  goals: Goal[];
  isLoading: boolean;
  error: string;
  activeGoalId: string | null;
  setActiveGoalId: (id: string) => void;
  isAddingGoal: boolean;
  startAddGoal: () => void;
  stopAddGoal: () => void;
  refreshGoals: () => Promise<void>;
}

const GoalsContext = createContext<GoalsState | undefined>(undefined);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeGoalId, setActiveGoalIdState] = useState<string | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  const refreshGoals = useCallback(async () => {
    if (!token) {
      setGoals([]);
      setActiveGoalIdState(null);
      setError('');
      setIsLoading(false);
      return;
    }
    try {
      const list = await listGoals();
      setGoals(list);
      setError('');
      setActiveGoalIdState((current) =>
        current && list.some((g) => g.id === current) ? current : (list[0]?.id ?? null)
      );
    } catch {
      // Deliberately does not clear `goals` here — a transient failure on a
      // refresh (not the very first load) must not make an already-onboarded
      // user look goal-less and get bounced back into onboarding.
      setError('목표 목록을 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    refreshGoals();
  }, [token, refreshGoals]);

  function setActiveGoalId(id: string) {
    setActiveGoalIdState(id);
  }

  function startAddGoal() {
    setIsAddingGoal(true);
  }

  function stopAddGoal() {
    setIsAddingGoal(false);
  }

  return (
    <GoalsContext.Provider
      value={{
        goals,
        isLoading,
        error,
        activeGoalId,
        setActiveGoalId,
        isAddingGoal,
        startAddGoal,
        stopAddGoal,
        refreshGoals,
      }}
    >
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within GoalsProvider');
  return ctx;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/context/GoalsContext.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: `App.tsx`에 `GoalsProvider` 배선**

`mobile/App.tsx`를 아래로 교체:
```tsx
import { AuthProvider } from './src/context/AuthContext';
import { GoalsProvider } from './src/context/GoalsContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <GoalsProvider>
        <RootNavigator />
      </GoalsProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/context/GoalsContext.tsx mobile/src/context/GoalsContext.test.tsx mobile/App.tsx
git commit -m "feat: add GoalsContext for goal list/active-goal/add-goal state"
```

---

## Task 7: `OnboardingChatScreen`

**Files:**
- Create: `mobile/src/screens/OnboardingChatScreen.tsx`
- Test: `mobile/src/screens/OnboardingChatScreen.test.tsx`

**Interfaces:**
- Consumes: `sendGoalChatMessage`, `ChatMessage` from `../api/goals`(Task 5); `useGoals` from `../context/GoalsContext`(Task 6, `refreshGoals`만 사용).
- Produces (Task 9가 사용): `<OnboardingChatScreen canCancel={boolean} onDone={() => void} />`. testID: `onboarding-cancel`(canCancel일 때만), `chat-message-list`, `chat-message-<index>`, `chat-input`, `chat-send`, `chat-error`, `chat-retry`, `goal-confirmed`, `goal-confirmed-continue`.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/OnboardingChatScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as goalsApi from '../api/goals';
import OnboardingChatScreen from './OnboardingChatScreen';

const mockRefreshGoals = jest.fn();

jest.mock('../api/goals');
jest.mock('../context/GoalsContext', () => ({
  useGoals: () => ({ refreshGoals: mockRefreshGoals }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OnboardingChatScreen', () => {
  it('sends a message and appends the assistant reply', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({ reply: '요즘 어때?', goalSet: false });
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '안녕');
    fireEvent.press(screen.getByTestId('chat-send'));

    await waitFor(() => expect(screen.getByTestId('chat-message-1')).toHaveTextContent('요즘 어때?'));
    expect(goalsApi.sendGoalChatMessage).toHaveBeenCalledWith([{ role: 'user', content: '안녕' }]);
  });

  it('shows the confirmation screen and refreshes goals when a goal is set', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({
      reply: '좋아!',
      goalSet: true,
      goal: { id: 'g1', title: '매일 달리기', category: 'EXERCISE', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '운동 습관 만들고 싶어');
    fireEvent.press(screen.getByTestId('chat-send'));

    await waitFor(() => expect(screen.getByTestId('goal-confirmed')).toHaveTextContent('매일 달리기'));
    expect(mockRefreshGoals).toHaveBeenCalled();
  });

  it('shows a retry button on failure and resends the same last message without duplicating it', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockRejectedValueOnce(new Error('메시지를 보내지 못했어요'));
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '안녕');
    fireEvent.press(screen.getByTestId('chat-send'));
    await waitFor(() => expect(screen.getByTestId('chat-error')).toBeTruthy());

    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({ reply: '다시 왔네', goalSet: false });
    fireEvent.press(screen.getByTestId('chat-retry'));

    await waitFor(() => expect(screen.getByTestId('chat-message-1')).toHaveTextContent('다시 왔네'));
    expect(goalsApi.sendGoalChatMessage).toHaveBeenLastCalledWith([{ role: 'user', content: '안녕' }]);
  });

  it('shows a cancel button only when canCancel is true', () => {
    const { rerender } = render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);
    expect(screen.queryByTestId('onboarding-cancel')).toBeNull();

    rerender(<OnboardingChatScreen canCancel onDone={() => {}} />);
    expect(screen.getByTestId('onboarding-cancel')).toBeTruthy();
  });

  it('calls onDone when the cancel button is pressed', () => {
    const onDone = jest.fn();
    render(<OnboardingChatScreen canCancel onDone={onDone} />);
    fireEvent.press(screen.getByTestId('onboarding-cancel'));
    expect(onDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/screens/OnboardingChatScreen.test.tsx`
Expected: FAIL with "Cannot find module './OnboardingChatScreen'"

- [ ] **Step 3: 구현 작성**

`mobile/src/screens/OnboardingChatScreen.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { sendGoalChatMessage, ChatMessage } from '../api/goals';
import { useGoals } from '../context/GoalsContext';

interface Props {
  canCancel: boolean;
  onDone: () => void;
}

export default function OnboardingChatScreen({ canCancel, onDone }: Props) {
  const { refreshGoals } = useGoals();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [goalConfirmed, setGoalConfirmed] = useState<string | null>(null);

  async function sendMessages(nextMessages: ChatMessage[]) {
    setError('');
    setSending(true);
    try {
      const result = await sendGoalChatMessage(nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }]);
      if (result.goalSet && result.goal) {
        setGoalConfirmed(result.goal.title);
        await refreshGoals();
      }
    } catch {
      setError('메시지를 보내지 못했어요');
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (input.trim().length === 0 || sending) return;
    const text = input.trim();
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    sendMessages(nextMessages);
  }

  function handleRetry() {
    sendMessages(messages);
  }

  if (goalConfirmed) {
    return (
      <View testID="goal-confirmed" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{`목표가 생겼어요: ${goalConfirmed}`}</Text>
        <TouchableOpacity testID="goal-confirmed-continue" onPress={onDone}>
          <Text>계속하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {canCancel ? (
        <TouchableOpacity testID="onboarding-cancel" onPress={onDone}>
          <Text>닫기</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView testID="chat-message-list">
        {messages.map((m, i) => (
          <Text key={i} testID={`chat-message-${i}`}>{`${m.role === 'user' ? '나' : '꾸미'}: ${m.content}`}</Text>
        ))}
      </ScrollView>
      {error ? (
        <View>
          <Text testID="chat-error">{error}</Text>
          <TouchableOpacity testID="chat-retry" onPress={handleRetry}>
            <Text>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <TextInput testID="chat-input" value={input} onChangeText={setInput} placeholder="메시지를 입력하세요" />
      <TouchableOpacity testID="chat-send" onPress={handleSend}>
        <Text>전송</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/screens/OnboardingChatScreen.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/OnboardingChatScreen.tsx mobile/src/screens/OnboardingChatScreen.test.tsx
git commit -m "feat: add OnboardingChatScreen for AI goal-setting chat"
```

---

## Task 8: `ProfileScreen`에 "새 목표 추가" 버튼

**Files:**
- Modify: `mobile/src/screens/ProfileScreen.tsx`
- Modify: `mobile/src/screens/ProfileScreen.test.tsx`

**Interfaces:**
- Consumes: `useGoals` from `../context/GoalsContext`(Task 6, `startAddGoal`만 사용).
- Produces (Task 9가 사용): `ProfileScreen`에 testID `add-goal-button` 버튼 추가, 누르면 `startAddGoal()` 호출.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/ProfileScreen.test.tsx`를 아래로 교체:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import ProfileScreen from './ProfileScreen';

const mockStartAddGoal = jest.fn();

jest.mock('../context/GoalsContext', () => ({
  useGoals: () => ({ startAddGoal: mockStartAddGoal }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProfileScreen', () => {
  it('logs out when the button is pressed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('logout-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('logout-button'));
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('growme_token'));
  });

  it('starts adding a goal when the button is pressed', async () => {
    render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('add-goal-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('add-goal-button'));
    expect(mockStartAddGoal).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/screens/ProfileScreen.test.tsx`
Expected: FAIL — `add-goal-button`이 아직 없음.

- [ ] **Step 3: 구현 수정**

`mobile/src/screens/ProfileScreen.tsx`:
```tsx
import { View, Text, Button } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { startAddGoal } = useGoals();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
      <Button title="새 목표 추가" onPress={() => startAddGoal()} testID="add-goal-button" />
      <Button title="로그아웃" onPress={() => logout()} testID="logout-button" />
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/screens/ProfileScreen.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/ProfileScreen.tsx mobile/src/screens/ProfileScreen.test.tsx
git commit -m "feat: add '새 목표 추가' button to ProfileScreen"
```

---

## Task 9: `RootNavigator` 3단 게이팅

**Files:**
- Modify: `mobile/src/navigation/RootNavigator.tsx`
- Modify: `mobile/src/navigation/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../context/AuthContext`; `useGoals` from `../context/GoalsContext`(Task 6, `goals`/`isLoading`/`error`/`isAddingGoal`/`stopAddGoal`/`refreshGoals`); `OnboardingChatScreen`(Task 7); `AuthStack`, `MainTabs`(기존).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/navigation/RootNavigator.test.tsx`를 아래로 교체:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import { GoalsProvider } from '../context/GoalsContext';
import * as goalsApi from '../api/goals';
import RootNavigator from './RootNavigator';

jest.mock('../api/goals');

function renderRoot() {
  return render(
    <AuthProvider>
      <GoalsProvider>
        <RootNavigator />
      </GoalsProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RootNavigator', () => {
  it('shows the auth stack when there is no stored token', async () => {
    renderRoot();
    await waitFor(() => expect(screen.getByText('그로우미')).toBeTruthy());
  });

  it('shows the onboarding chat without a cancel button when logged in with no goals', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([]);
    renderRoot();
    await waitFor(() => expect(screen.getByTestId('chat-input')).toBeTruthy());
    expect(screen.queryByTestId('onboarding-cancel')).toBeNull();
  });

  it('shows the main tabs when logged in with at least one goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([
      { id: 'g1', title: '목표', category: 'ETC', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('no network in this test'))) as unknown as typeof fetch;
    renderRoot();
    await waitFor(() => expect(screen.getByText('히스토리')).toBeTruthy());
  });

  it('shows a cancelable onboarding chat when adding a goal from the profile tab', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([
      { id: 'g1', title: '목표', category: 'ETC', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('no network in this test'))) as unknown as typeof fetch;
    renderRoot();
    await waitFor(() => expect(screen.getByText('히스토리')).toBeTruthy());

    fireEvent.press(screen.getByText('프로필'));
    await waitFor(() => expect(screen.getByTestId('add-goal-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('add-goal-button'));

    await waitFor(() => expect(screen.getByTestId('onboarding-cancel')).toBeTruthy());
  });

  it('shows a retry view when the initial goals load fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    renderRoot();
    await waitFor(() => expect(screen.getByTestId('goals-retry')).toBeTruthy());
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd mobile && npm test -- src/navigation/RootNavigator.test.tsx`
Expected: FAIL — `GoalsProvider`는 있지만 `RootNavigator`가 아직 `useGoals`를 쓰지 않아 목표 유무와 무관하게 항상 `MainTabs`(또는 이전 로직)를 보여줌.

- [ ] **Step 3: 구현 수정**

`mobile/src/navigation/RootNavigator.tsx`를 아래로 교체:
```tsx
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';

export default function RootNavigator() {
  const { token, isLoading: authLoading } = useAuth();
  const { goals, isLoading: goalsLoading, error: goalsError, isAddingGoal, stopAddGoal, refreshGoals } = useGoals();

  if (authLoading || (token && goalsLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  let content;
  if (!token) {
    content = <AuthStack />;
  } else if (goals.length === 0 && goalsError) {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{goalsError}</Text>
        <TouchableOpacity testID="goals-retry" onPress={() => refreshGoals()}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (goals.length === 0) {
    content = <OnboardingChatScreen canCancel={false} onDone={stopAddGoal} />;
  } else if (isAddingGoal) {
    content = <OnboardingChatScreen canCancel onDone={stopAddGoal} />;
  } else {
    content = <MainTabs />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/navigation/RootNavigator.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/navigation/RootNavigator.tsx mobile/src/navigation/RootNavigator.test.tsx
git commit -m "feat: gate RootNavigator on goal existence and add-goal flow"
```

---

## Task 10: `HomeScreen` 목표 전환 칩 + 할일 필터링

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Modify: `mobile/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `useGoals` from `../context/GoalsContext`(Task 6, `goals`/`activeGoalId`/`setActiveGoalId`); `Task.goalId`(Task 5).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/HomeScreen.test.tsx`를 아래로 교체:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from '../api/tasks';
import * as growthApi from '../api/growth';
import HomeScreen from './HomeScreen';

jest.mock('../api/tasks');
jest.mock('../api/growth');

const mockSetActiveGoalId = jest.fn();
const mockUseGoals = jest.fn();
jest.mock('../context/GoalsContext', () => ({
  useGoals: () => mockUseGoals(),
}));

const growthState: growthApi.GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: null,
};

const taskInGoalA: tasksApi.Task = {
  id: '1',
  title: '운동하기',
  category: 'EXERCISE',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: 'goal-a',
};

const taskInGoalB: tasksApi.Task = {
  id: '2',
  title: '독서하기',
  category: 'READING',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: 'goal-b',
};

const goals = [
  { id: 'goal-a', title: '운동 목표', category: 'EXERCISE' as const, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'goal-b', title: '독서 목표', category: 'READING' as const, createdAt: '2026-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalA, taskInGoalB]);
  (growthApi.getGrowth as jest.Mock).mockResolvedValue(growthState);
  (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED' });
  (tasksApi.createTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, id: '3', title: '새 할일' });
  mockUseGoals.mockReturnValue({ goals, activeGoalId: 'goal-a', setActiveGoalId: mockSetActiveGoalId });
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

  it("shows only the active goal's tasks in the task sheet", async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText(/운동하기/)).toBeTruthy();
    expect(screen.queryByText(/독서하기/)).toBeNull();
  });

  it('switches the active goal when a chip is pressed', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('goal-chip-goal-b')).toBeTruthy());
    fireEvent.press(screen.getByTestId('goal-chip-goal-b'));
    expect(mockSetActiveGoalId).toHaveBeenCalledWith('goal-b');
  });

  it('completes a task from the sheet and refreshes growth', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(growthApi.getGrowth).toHaveBeenCalledTimes(2));
  });

  it('creates a task from the sheet form tagged with the active goal', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '새 할일');
    fireEvent.press(screen.getByTestId('add-task-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('새 할일', 'ETC', 'EASY', 'TODAY', 'goal-a')
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
Expected: FAIL — `useGoals` 미사용으로 `goal-chip-goal-b`가 없고, `TaskSheet`가 두 할일을 모두 보여주며, `createTask` 호출에 `goalId` 인자가 빠짐.

- [ ] **Step 3: 구현 수정**

`mobile/src/screens/HomeScreen.tsx`를 아래로 교체:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask } from '../api/tasks';
import { GrowthState, getGrowth } from '../api/growth';
import { useGoals } from '../context/GoalsContext';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import TaskSheet from '../components/TaskSheet';

export default function HomeScreen() {
  const { goals, activeGoalId, setActiveGoalId } = useGoals();
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
    await refresh();
    if (failureMessage) setError(failureMessage);
  }

  async function handleCreate(title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) {
    try {
      await createTask(title, category, difficulty, dueChoice, activeGoalId ?? undefined);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  const visibleTasks = tasks.filter((t) => t.goalId === activeGoalId);

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF4EF' }}>
      <ScrollView horizontal testID="goal-chip-list" style={{ maxHeight: 48, flexGrow: 0 }}>
        {goals.map((g) => (
          <TouchableOpacity
            key={g.id}
            testID={`goal-chip-${g.id}`}
            onPress={() => setActiveGoalId(g.id)}
            style={{ padding: 8, opacity: g.id === activeGoalId ? 1 : 0.5 }}
          >
            <Text>{g.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
      <TaskSheet tasks={visibleTasks} onComplete={handleComplete} onCreate={handleCreate} />
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npm test -- src/screens/HomeScreen.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: 모바일 전체 스위트 + 타입체크**

Run:
```bash
cd mobile
npm test
npx tsc --noEmit
```
Expected: 전체 스위트 PASS, `tsc` 에러 없음. 이것으로 서브프로젝트 3의 모든 태스크가 끝난다.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/HomeScreen.test.tsx
git commit -m "feat: add goal-switcher chips to HomeScreen and filter tasks by active goal"
```
