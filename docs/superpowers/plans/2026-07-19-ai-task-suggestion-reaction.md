# AI 할일 추천 + 완료/실패 리액션 대화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목표(Goal) 기반 AI 할일 추천과, 태스크 완료/실패 시 꾸미의 성격 반영 AI 리액션을 추가한다.

**Architecture:** `goalChat.ts`와 동일한 stateless Claude tool-use 패턴을 재사용한다. 추천은 DB에 저장하지 않고 응답으로만 내려주며, 리액션은 `Task`에 `reactionText`/`reactionShownAt` 두 컬럼만 추가해 저장한다. 3개 Claude 서비스(goalChat, taskSuggestions, reactions)가 `anthropicClient.ts`의 lazy singleton을 공유하도록 리팩터링한다.

**Tech Stack:** 백엔드 Express+Prisma+vitest+supertest, `@anthropic-ai/sdk`(`claude-sonnet-5`). 모바일 React Native(Expo)+jest+`@testing-library/react-native`.

## Global Constraints

- 스펙 문서: `docs/superpowers/specs/2026-07-19-ai-task-suggestion-reaction-design.md` (커밋 aa45b0f)
- **스펙 대비 변경 사항(계획 작성 중 발견해 수정함):** 스펙은 `GET /api/tasks` 응답에 `pendingReactions` 필드를 추가하되 "기존 `tasks` 배열은 그대로 유지(하위호환)"라고 적었지만, 실제로는 응답 최상위가 배열(`Task[]`)이라 래퍼 객체로 바꾸면 기존 테스트(`res.body`를 배열로 취급)가 전부 깨진다. 대신 **`GET /api/tasks`는 그대로 `Task[]` 배열을 반환**하고, 각 `Task`가 이미 갖게 되는 `reactionText`/`reactionShownAt` 필드를 클라이언트가 직접 필터링해 `pendingReactions`를 계산한다. 진짜 하위호환이 되는 쪽으로 바꿨다.
- 모든 커밋 메시지는 한글로 작성한다.
- 모든 신규 텍스트(에러 메시지 등)는 기존 코드처럼 한글로 작성한다.
- 백엔드는 `cd backend && npm test`(vitest, 실제 Postgres 사용, mock DB 없음)로 검증한다. `growme-postgres` 컨테이너가 떠 있어야 한다(이미 확인/기동함).
- 모바일은 `cd mobile && npm test`(jest)로 검증한다.
- 각 태스크 끝에서 백엔드는 `npx tsc --noEmit`, 모바일도 `npx tsc --noEmit`이 클린해야 한다.
- Anthropic 호출은 전부 `vi.mock('@anthropic-ai/sdk', ...)`로 모킹한다 — 실제 API 키 불필요.

---

## Task 1: Prisma 스키마에 리액션 필드 추가

**Files:**
- Modify: `backend/prisma/schema.prisma:79-93` (`Task` 모델)

**Interfaces:**
- Produces: `Task.reactionText: string | null`, `Task.reactionShownAt: Date | null` — 이후 모든 백엔드 태스크가 이 두 필드를 참조한다.

- [ ] **Step 1: 스키마에 필드 추가**

`backend/prisma/schema.prisma`의 `Task` 모델을 다음과 같이 수정한다 (기존 필드는 그대로 두고 두 줄만 추가):

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
}
```

- [ ] **Step 2: 개발 DB와 테스트 DB에 스키마 반영 + 클라이언트 생성**

```bash
cd backend
npx prisma db push --skip-generate
npx cross-env DATABASE_URL=$TEST_DATABASE_URL npx prisma db push --skip-generate
npx prisma generate
```

Expected: 두 `db push` 모두 "Your database is now in sync with your Prisma schema." 출력, `generate`는 에러 없이 완료.

- [ ] **Step 3: 기존 테스트가 여전히 통과하는지 확인**

Run: `cd backend && npm test`
Expected: 기존 테스트 전부 PASS (새 필드는 전부 optional이라 기존 코드에 영향 없음).

- [ ] **Step 4: 커밋**

```bash
git add backend/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat: Task에 reactionText/reactionShownAt 필드 추가

완료/실패 리액션 문구와 확인 여부를 저장하기 위한 스키마 변경.
EOF
)"
```

---

## Task 2: `anthropicClient.ts` 공유 모듈로 리팩터링

**Files:**
- Create: `backend/src/services/anthropicClient.ts`
- Modify: `backend/src/services/goalChat.ts:1-11`
- Test: `backend/src/services/anthropicClient.test.ts`

**Interfaces:**
- Produces: `getAnthropicClient(): Anthropic` — Task 3, 4가 이 함수를 import해서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/services/anthropicClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockAnthropic } = vi.hoisted(() => ({ MockAnthropic: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

import { getAnthropicClient } from './anthropicClient';

beforeEach(() => {
  MockAnthropic.mockClear();
});

describe('getAnthropicClient', () => {
  it('constructs the client only once across multiple calls (lazy singleton)', () => {
    getAnthropicClient();
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledTimes(1);
  });

  it('passes ANTHROPIC_API_KEY from the environment', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/services/anthropicClient.test.ts`
Expected: FAIL — `anthropicClient` 모듈이 없어서 import 에러.

- [ ] **Step 3: 최소 구현**

`backend/src/services/anthropicClient.ts` 새로 작성:

```ts
import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}
```

`backend/src/services/goalChat.ts`의 1~11번 줄을 다음으로 교체 (lazy singleton 로직을 새 모듈 import로 대체):

```ts
import Anthropic from '@anthropic-ai/sdk';
import { Category } from '@prisma/client';
import { getAnthropicClient } from './anthropicClient';
```

그리고 원래 4~11번째 줄에 있던 `let anthropicClient`, `function getAnthropicClient()` 정의는 삭제한다. (파일 나머지 — `SYSTEM_PROMPT`부터 끝까지 — 는 그대로 둔다. `getAnthropicClient()` 호출부인 43번째 줄의 `getAnthropicClient().messages.create(...)`는 수정 없이 그대로 동작한다.)

주의: 두 테스트 파일(`anthropicClient.test.ts`와 `goalChat.test.ts`)이 같은 모듈(`@anthropic-ai/sdk`)을 각자 mock하는데, `anthropicClient.ts`가 모듈 스코프 싱글턴(`anthropicClient` 변수)을 쓰므로 vitest가 테스트 파일마다 별도 모듈 레지스트리를 쓰는지 확인이 필요하다 — vitest는 기본적으로 파일별로 격리된 모듈 인스턴스를 쓰므로 문제없다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/services/anthropicClient.test.ts src/services/goalChat.test.ts`
Expected: 둘 다 전부 PASS.

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS, tsc 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/anthropicClient.ts backend/src/services/anthropicClient.test.ts backend/src/services/goalChat.ts
git commit -m "$(cat <<'EOF'
refactor: Anthropic 클라이언트 lazy singleton을 공유 모듈로 추출

taskSuggestions/reactions 서비스가 같은 로직을 재사용할 수 있도록
goalChat.ts에 있던 getAnthropicClient()를 services/anthropicClient.ts로 이동.
EOF
)"
```

---

## Task 3: `taskSuggestions.ts` 서비스 (AI 할일 추천)

**Files:**
- Create: `backend/src/services/taskSuggestions.ts`
- Test: `backend/src/services/taskSuggestions.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient()` from `./anthropicClient` (Task 2).
- Produces: `suggestTasks(goal: { title: string; category: Category }): Promise<TaskSuggestion[]>`, `interface TaskSuggestion { title: string; category: Category; difficulty: Difficulty; dueChoice: 'TODAY' | 'THIS_WEEK' }` — Task 5(라우트)가 이 함수와 타입을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/services/taskSuggestions.test.ts`:

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

import { suggestTasks } from './taskSuggestions';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('suggestTasks', () => {
  it('parses valid suggestions from the tool call', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_tasks',
          input: {
            suggestions: [
              { title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
              { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'THIS_WEEK' },
            ],
          },
        },
      ],
    });
    const result = await suggestTasks({ title: '매일 영어 공부', category: 'STUDY' });
    expect(result).toEqual([
      { title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
      { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'THIS_WEEK' },
    ]);
  });

  it('drops suggestions with an invalid category, keeping valid ones', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_tasks',
          input: {
            suggestions: [
              { title: '유효함', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
              { title: '무효함', category: 'NOT_REAL', difficulty: 'EASY', dueChoice: 'TODAY' },
            ],
          },
        },
      ],
    });
    const result = await suggestTasks({ title: '목표', category: 'STUDY' });
    expect(result).toEqual([{ title: '유효함', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' }]);
  });

  it('returns an empty array when the model does not call the tool', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '음...' }] });
    const result = await suggestTasks({ title: '목표', category: 'STUDY' });
    expect(result).toEqual([]);
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(suggestTasks({ title: '목표', category: 'STUDY' })).rejects.toThrow('rate limited');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/services/taskSuggestions.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`backend/src/services/taskSuggestions.ts`:

```ts
import { Category, Difficulty } from '@prisma/client';
import { getAnthropicClient } from './anthropicClient';

export interface TaskSuggestion {
  title: string;
  category: Category;
  difficulty: Difficulty;
  dueChoice: 'TODAY' | 'THIS_WEEK';
}

const CATEGORIES = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const DUE_CHOICES = ['TODAY', 'THIS_WEEK'];

const SYSTEM_PROMPT = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자의 목표를 보고, 오늘 하루 안에 실행할 수 있을 만한 구체적인 하위 태스크를 1~5개 제안해. 반드시 suggest_tasks 도구를 호출해서 제안해.`;

const SUGGEST_TASKS_TOOL = {
  name: 'suggest_tasks',
  description: '목표에 대한 실행 가능한 하위 태스크를 1~5개 제안할 때 호출한다',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array' as const,
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            category: { type: 'string' as const, enum: CATEGORIES },
            difficulty: { type: 'string' as const, enum: DIFFICULTIES },
            dueChoice: { type: 'string' as const, enum: DUE_CHOICES },
          },
          required: ['title', 'category', 'difficulty', 'dueChoice'],
        },
      },
    },
    required: ['suggestions'],
  },
};

function isValidSuggestion(value: unknown): value is TaskSuggestion {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    v.title.length > 0 &&
    typeof v.category === 'string' &&
    CATEGORIES.includes(v.category) &&
    typeof v.difficulty === 'string' &&
    DIFFICULTIES.includes(v.difficulty) &&
    typeof v.dueChoice === 'string' &&
    DUE_CHOICES.includes(v.dueChoice)
  );
}

export async function suggestTasks(goal: { title: string; category: Category }): Promise<TaskSuggestion[]> {
  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TASKS_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_tasks' },
    messages: [{ role: 'user', content: `목표: ${goal.title} (카테고리: ${goal.category})` }],
  });

  const content = response.content as Array<{ type: string; name?: string; input?: unknown }>;
  const toolBlock = content.find((b) => b.type === 'tool_use' && b.name === 'suggest_tasks');
  if (!toolBlock) return [];

  const input = toolBlock.input as { suggestions?: unknown };
  if (!Array.isArray(input.suggestions)) return [];

  return input.suggestions.filter(isValidSuggestion);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/services/taskSuggestions.test.ts`
Expected: 4개 테스트 전부 PASS.

- [ ] **Step 5: 타입체크**

Run: `cd backend && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/taskSuggestions.ts backend/src/services/taskSuggestions.test.ts
git commit -m "$(cat <<'EOF'
feat: 목표 기반 AI 할일 추천 서비스 추가

Claude tool-use로 목표당 1~5개의 태스크 후보를 생성. DB에는 저장하지 않고
호출자에게 후보 배열만 반환한다.
EOF
)"
```

---

## Task 4: `reactions.ts` 서비스 (완료/실패 AI 리액션)

**Files:**
- Create: `backend/src/services/reactions.ts`
- Test: `backend/src/services/reactions.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient()` from `./anthropicClient` (Task 2); `Personality` type from `./growth` (`backend/src/services/growth.ts:55-59`, already exists — `{ axisA: 'STEADY'|'LOOSE'; axisB: 'EASYGOING'|'LASTMINUTE'; type: string }`).
- Produces: `generateReaction(task: { title: string }, personality: Personality | null, outcome: 'COMPLETED' | 'FAILED'): Promise<string>` — Task 6, 7이 이 함수를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/services/reactions.test.ts`:

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

import { generateReaction } from './reactions';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('generateReaction', () => {
  it('returns the text block from a completed reaction', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '잘했어! 대단해!' }] });
    const result = await generateReaction({ title: '리스닝 20분' }, null, 'COMPLETED');
    expect(result).toBe('잘했어! 대단해!');
  });

  it('falls back to a neutral prompt when personality is null', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, null, 'COMPLETED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('아직 사용자의 성격 유형을 알 수 없어');
  });

  it('includes STEADY/EASYGOING personality description in the prompt', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, { axisA: 'STEADY', axisB: 'EASYGOING', type: 'STEADY_EASYGOING' }, 'COMPLETED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('꾸준한 편');
    expect(call.system).toContain('여유있게');
  });

  it('includes LOOSE/LASTMINUTE personality description in the prompt', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, { axisA: 'LOOSE', axisB: 'LASTMINUTE', type: 'LOOSE_LASTMINUTE' }, 'FAILED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('느슨한 편');
    expect(call.system).toContain('막판에 몰아치는 편');
  });

  it('throws when the response has no text block', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'tool_use', name: 'irrelevant', input: {} }] });
    await expect(generateReaction({ title: 'x' }, null, 'COMPLETED')).rejects.toThrow('no reaction text returned');
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(generateReaction({ title: 'x' }, null, 'FAILED')).rejects.toThrow('rate limited');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/services/reactions.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`backend/src/services/reactions.ts`:

```ts
import { getAnthropicClient } from './anthropicClient';
import { Personality } from './growth';

const OUTCOME_LABEL = { COMPLETED: '완료', FAILED: '실패' } as const;

function personalityDescription(personality: Personality | null): string {
  if (!personality) {
    return '아직 사용자의 성격 유형을 알 수 없어. 중립적인 톤으로 반응해줘.';
  }
  const axisADesc = personality.axisA === 'STEADY' ? '꾸준한 편이고' : '느슨한 편이고';
  const axisBDesc =
    personality.axisB === 'EASYGOING' ? '마감보다 여유있게 끝내는 편이야' : '마감 막판에 몰아치는 편이야';
  return `이 사용자는 ${axisADesc} ${axisBDesc}. 그 성격에 맞는 말투로 반응해줘.`;
}

export async function generateReaction(
  task: { title: string },
  personality: Personality | null,
  outcome: 'COMPLETED' | 'FAILED'
): Promise<string> {
  const systemPrompt = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자가 태스크를 ${OUTCOME_LABEL[outcome]}했어. ${personalityDescription(personality)} 스크립트처럼 정형화된 말고, 태스크 '${task.title}'에 대해 짧게 한두 문장으로 자연스럽게 반응해.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: `태스크: ${task.title}` }],
  });

  const content = response.content as Array<{ type: string; text?: string }>;
  const textBlock = content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('no reaction text returned');
  return textBlock.text;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/services/reactions.test.ts`
Expected: 6개 테스트 전부 PASS.

- [ ] **Step 5: 타입체크**

Run: `cd backend && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/reactions.ts backend/src/services/reactions.test.ts
git commit -m "$(cat <<'EOF'
feat: 완료/실패 태스크에 대한 꾸미의 성격 반영 AI 리액션 서비스 추가
EOF
)"
```

---

## Task 5: `POST /api/goals/:id/suggest-tasks` 라우트

**Files:**
- Modify: `backend/src/routes/goals.ts`
- Test: `backend/src/routes/goals.test.ts`

**Interfaces:**
- Consumes: `suggestTasks` from `../services/taskSuggestions` (Task 3).
- Produces: `POST /api/goals/:id/suggest-tasks` → `200 { suggestions: TaskSuggestion[] }` | `404` | `502`.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/goals.test.ts` 끝에 추가 (기존 `vi.mock('@anthropic-ai/sdk', ...)`와 `mockCreate`를 그대로 재사용— 이미 파일 상단에 있음):

```ts
describe('POST /api/goals/:id/suggest-tasks', () => {
  it('returns suggestions for a goal owned by the caller', async () => {
    const token = await signup('suggest1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decoded.userId, title: '매일 영어 공부', category: 'STUDY' } });
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_tasks',
          input: { suggestions: [{ title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' }] },
        },
      ],
    });

    const res = await request(app)
      .post(`/api/goals/${goal.id}/suggest-tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([{ title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' }]);
  });

  it("returns 404 for another user's goal", async () => {
    const tokenA = await signup('suggest2@example.com');
    const tokenB = await signup('suggest3@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decodedA.userId, title: 'A의 목표', category: 'STUDY' } });

    const res = await request(app)
      .post(`/api/goals/${goal.id}/suggest-tasks`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent goal', async () => {
    const token = await signup('suggest4@example.com');
    const res = await request(app)
      .post('/api/goals/nonexistent-id/suggest-tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 502 when the Anthropic call fails', async () => {
    const token = await signup('suggest5@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const goal = await prisma.goal.create({ data: { userId: decoded.userId, title: '목표', category: 'STUDY' } });
    mockCreate.mockRejectedValue(new Error('rate limited'));

    const res = await request(app)
      .post(`/api/goals/${goal.id}/suggest-tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(502);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/goals/some-id/suggest-tasks');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/routes/goals.test.ts`
Expected: 새로 추가한 5개 테스트 FAIL (라우트 없음 → 404 대신 이전 라우트에 안 걸려 발생하는 에러 등).

- [ ] **Step 3: 최소 구현**

`backend/src/routes/goals.ts`의 import 목록에 추가:

```ts
import { suggestTasks } from '../services/taskSuggestions';
```

`export default router;` 바로 위에 새 라우트 추가:

```ts
router.post('/:id/suggest-tasks', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const goal = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!goal) {
      return res.status(404).json({ error: 'goal not found' });
    }
    const suggestions = await suggestTasks({ title: goal.title, category: goal.category });
    res.json({ suggestions });
  } catch {
    res.status(502).json({ error: 'failed to generate suggestions' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/routes/goals.test.ts`
Expected: 전부 PASS.

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/goals.ts backend/src/routes/goals.test.ts
git commit -m "$(cat <<'EOF'
feat: POST /api/goals/:id/suggest-tasks 라우트 추가

목표 소유자만 호출 가능. 결과는 저장하지 않고 후보만 반환한다.
EOF
)"
```

---

## Task 6: `PATCH /api/tasks/:id/complete`에 완료 리액션 연결

**Files:**
- Modify: `backend/src/routes/tasks.ts:1-6, 96-117`
- Test: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Consumes: `computePersonality` from `../services/growth` (이미 존재); `generateReaction` from `../services/reactions` (Task 4).
- Produces: `PATCH /api/tasks/:id/complete` 응답 `Task`에 `reactionText: string | null` 필드 포함, 성공 시 `reactionShownAt`도 세팅됨.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/tasks.test.ts` 상단에 mock 추가 (파일 최상단, `import request from 'supertest';` 다음 줄에):

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
  mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '잘했어!' }] });
});
```

주의: 파일에 이미 `import { describe, it, expect } from 'vitest';`가 있으므로, 이 줄을 `import { describe, it, expect, vi, beforeEach } from 'vitest';`로 합치고 위 블록에서 중복 import는 제거한다.

`describe('PATCH /api/tasks/:id/complete', ...)` 블록 안에 테스트 추가:

```ts
  it('generates and stores a reaction on successful completion', async () => {
    const token = await signup('taskreact1@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '반응 태스크', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reactionText).toBe('잘했어!');

    const stored = await prisma.task.findUnique({ where: { id: createRes.body.id } });
    expect(stored?.reactionShownAt).not.toBeNull();
  });

  it('completes successfully with reactionText null when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const token = await signup('taskreact2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '반응 실패 태스크', category: 'STUDY', difficulty: 'EASY', dueChoice: 'THIS_WEEK' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.reactionText).toBeNull();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 새 2개 테스트 FAIL (`reactionText`가 응답에 없음/undefined).

- [ ] **Step 3: 최소 구현**

`backend/src/routes/tasks.ts` 상단 import에 추가:

```ts
import { computePersonality } from '../services/growth';
import { generateReaction } from '../services/reactions';
```

`router.patch('/:id/complete', ...)` 핸들러(96~117번 줄)를 다음으로 교체:

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
    let updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    try {
      const personality = await computePersonality(req.userId!);
      const reactionText = await generateReaction(updated, personality, 'COMPLETED');
      updated = await prisma.task.update({
        where: { id: task.id },
        data: { reactionText, reactionShownAt: new Date() },
      });
    } catch {
      // 리액션 생성은 best-effort — 실패해도 완료 처리 자체는 이미 끝난 상태.
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 전부 PASS (새 2개 포함, 기존 테스트도 그대로 — `mockCreate` 기본 응답이 텍스트만 주므로 기존 완료 테스트들의 `res.body.status`/`completedAt` 검증에는 영향 없음).

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "$(cat <<'EOF'
feat: 태스크 완료 시 꾸미의 AI 리액션을 생성해 즉시 응답에 포함

Claude 호출이 실패해도 완료 처리 자체는 항상 성공한다(reactionText만 null).
EOF
)"
```

---

## Task 7: `GET /api/tasks`에서 FAILED 건 리액션 lazy 생성

**Files:**
- Modify: `backend/src/routes/tasks.ts:79-94`
- Test: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Consumes: `computePersonality`, `generateReaction` (Task 6에서 이미 import됨).
- Produces: `GET /api/tasks` 응답의 각 `Task`에 `reactionText`/`reactionShownAt` 포함, FAILED로 새로 바뀐 건은 `reactionText`가 채워진 채로 내려온다.

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('GET /api/tasks', ...)` 블록 안에 추가:

```ts
  it('generates and stores a reaction for a newly-FAILED task', async () => {
    const token = await signup('taskfailreact1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '실패할 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.find((t: { id: string }) => t.id === overdue.id);
    expect(found.status).toBe('FAILED');
    expect(found.reactionText).toBe('잘했어!');
    expect(found.reactionShownAt).toBeNull();
  });

  it('does not call Anthropic again for a FAILED task that already has a reaction', async () => {
    const token = await signup('taskfailreact2@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '이미 반응 있음',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('leaves reactionText null when Anthropic fails, without breaking the list response', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const token = await signup('taskfailreact3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const overdue = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '반응 생성 실패',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.find((t: { id: string }) => t.id === overdue.id);
    expect(found.status).toBe('FAILED');
    expect(found.reactionText).toBeNull();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 새 3개 테스트 FAIL (`reactionText`가 항상 `null`).

- [ ] **Step 3: 최소 구현**

`router.get('/', ...)` 핸들러(79~94번 줄)를 다음으로 교체:

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

    const needsReaction = tasks.filter((t) => t.status === 'FAILED' && t.reactionText === null);
    if (needsReaction.length > 0) {
      const personality = await computePersonality(req.userId!);
      for (const t of needsReaction) {
        try {
          const reactionText = await generateReaction(t, personality, 'FAILED');
          const updated = await prisma.task.update({ where: { id: t.id }, data: { reactionText } });
          const idx = tasks.findIndex((x) => x.id === t.id);
          tasks[idx] = updated;
        } catch {
          // 실패한 건은 reactionText가 계속 null이라 다음 GET에서 자동 재시도된다.
        }
      }
    }

    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 전부 PASS.

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "$(cat <<'EOF'
feat: 마감 지나 FAILED된 태스크에 대해 lazy하게 AI 리액션 생성

이미 reactionText가 있는 건은 재호출하지 않고, 생성 실패 시 다음 조회에서
자동 재시도된다.
EOF
)"
```

---

## Task 8: `PATCH /api/tasks/:id/ack-reaction` 라우트

**Files:**
- Modify: `backend/src/routes/tasks.ts` (새 라우트 추가)
- Test: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Produces: `PATCH /api/tasks/:id/ack-reaction` → `204` | `404` | `409`.

- [ ] **Step 1: 실패하는 테스트 작성**

파일 끝, `export default router;` 이전 마지막 `describe` 블록 뒤에 추가:

```ts
describe('PATCH /api/tasks/:id/ack-reaction', () => {
  it('marks a pending reaction as shown', async () => {
    const token = await signup('taskack1@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const task = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '실패한 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
        status: 'FAILED',
        reactionText: '괜찮아, 다음엔 잘할 거야',
      },
    });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}/ack-reaction`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const stored = await prisma.task.findUnique({ where: { id: task.id } });
    expect(stored?.reactionShownAt).not.toBeNull();
  });

  it('rejects acking a task with no reaction', async () => {
    const token = await signup('taskack2@example.com');
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '반응 없는 할일', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' });

    const res = await request(app)
      .patch(`/api/tasks/${createRes.body.id}/ack-reaction`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('rejects acking an already-shown reaction', async () => {
    const token = await signup('taskack3@example.com');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const task = await prisma.task.create({
      data: {
        userId: decoded.userId,
        title: '이미 확인함',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
        status: 'FAILED',
        reactionText: '괜찮아',
        reactionShownAt: new Date(),
      },
    });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}/ack-reaction`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it("returns 404 for another user's task", async () => {
    const tokenA = await signup('taskack4@example.com');
    const tokenB = await signup('taskack5@example.com');
    const decodedA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
    const task = await prisma.task.create({
      data: {
        userId: decodedA.userId,
        title: 'A의 할일',
        category: 'ETC',
        difficulty: 'EASY',
        xpValue: 10,
        dueAt: new Date(Date.now() - 60_000),
        status: 'FAILED',
        reactionText: '괜찮아',
      },
    });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}/ack-reaction`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 새 4개 테스트 FAIL (라우트 없음 → 404 unmatched route 등 기대와 다른 상태 코드).

- [ ] **Step 3: 최소 구현**

`export default router;` 바로 위에 추가:

```ts
router.patch('/:id/ack-reaction', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!task) {
      return res.status(404).json({ error: 'task not found' });
    }
    if (!task.reactionText || task.reactionShownAt) {
      return res.status(409).json({ error: 'no pending reaction' });
    }
    await prisma.task.update({ where: { id: task.id }, data: { reactionShownAt: new Date() } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run src/routes/tasks.test.ts`
Expected: 전부 PASS.

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: 전부 PASS. 이 시점에서 백엔드 작업이 전부 끝난다.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "$(cat <<'EOF'
feat: PATCH /api/tasks/:id/ack-reaction 라우트 추가

lazy하게 생성된(FAILED) 리액션을 클라이언트가 본 뒤 확인 처리하는 엔드포인트.
EOF
)"
```

---

## Task 9: 모바일 API 클라이언트 확장

**Files:**
- Modify: `mobile/src/api/tasks.ts`
- Modify: `mobile/src/api/goals.ts`

**Interfaces:**
- Produces: `Task.reactionText: string | null`, `Task.reactionShownAt: string | null` (`mobile/src/api/tasks.ts`); `ackReaction(id: string): Promise<void>`; `interface TaskSuggestion { title: string; category: Category; difficulty: Difficulty; dueChoice: DueChoice }`; `suggestTasks(goalId: string): Promise<TaskSuggestion[]>` (`mobile/src/api/goals.ts`) — Task 10, 11, 12가 이들을 쓴다.

이 태스크는 순수 타입/함수 추가라 별도 단위 테스트 파일이 없다(레포에 `mobile/src/api/*.test.ts`가 존재하지 않는 기존 컨벤션과 동일 — API 클라이언트는 화면 테스트에서 `jest.mock`으로 간접 검증됨). `tsc --noEmit`과 기존 전체 테스트 그린 유지로 검증한다.

- [ ] **Step 1: `mobile/src/api/tasks.ts` 수정**

`Task` 인터페이스(8~19번 줄)에 두 필드 추가:

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
  reactionText: string | null;
  reactionShownAt: string | null;
}
```

파일 끝에 함수 추가:

```ts
export async function ackReaction(id: string): Promise<void> {
  const res = await apiFetch(`/api/tasks/${id}/ack-reaction`, { method: 'PATCH' });
  if (!res.ok) throw new Error('리액션 확인 처리에 실패했어요');
}
```

- [ ] **Step 2: `mobile/src/api/goals.ts` 수정**

import 줄을 다음으로 교체:

```ts
import { apiFetch } from './client';
import { Category, Difficulty, DueChoice } from './tasks';
```

파일 끝에 타입/함수 추가:

```ts
export interface TaskSuggestion {
  title: string;
  category: Category;
  difficulty: Difficulty;
  dueChoice: DueChoice;
}

export async function suggestTasks(goalId: string): Promise<TaskSuggestion[]> {
  const res = await apiFetch(`/api/goals/${goalId}/suggest-tasks`, { method: 'POST' });
  if (!res.ok) throw new Error('추천을 가져오지 못했어요');
  const body = await res.json();
  return body.suggestions;
}
```

- [ ] **Step 3: 기존 테스트 픽스처가 새 필수 필드 때문에 깨지지 않는지 확인**

`Task` 인터페이스에 필드를 추가하면 기존에 `Task` 객체 리터럴을 만드는 테스트 픽스처들(`mobile/src/components/TaskSheet.test.tsx:6-7`, `mobile/src/screens/HomeScreen.test.tsx:24-48`)이 `tsc` 타입 에러를 낸다. 두 파일 모두에서 기존 태스크 객체 리터럴마다 `reactionText: null, reactionShownAt: null`을 추가한다.

`mobile/src/components/TaskSheet.test.tsx` 5~8번 줄:

```ts
const tasks: Task[] = [
  { id: '1', title: '운동하기', category: 'EXERCISE', difficulty: 'EASY', xpValue: 10, dueAt: new Date().toISOString(), status: 'PENDING', completedAt: null, createdAt: new Date().toISOString(), goalId: null, reactionText: null, reactionShownAt: null },
  { id: '2', title: '독서 30분', category: 'READING', difficulty: 'MEDIUM', xpValue: 20, dueAt: new Date().toISOString(), status: 'COMPLETED', completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), goalId: null, reactionText: null, reactionShownAt: null },
];
```

`mobile/src/screens/HomeScreen.test.tsx`의 `taskInGoalA`(24~35번 줄)와 `taskInGoalB`(37~48번 줄) 객체 리터럴 각각에도 `reactionText: null, reactionShownAt: null,`을 `goalId` 줄 다음에 추가한다.

- [ ] **Step 4: 타입체크 + 전체 테스트**

Run: `cd mobile && npx tsc --noEmit && npm test`
Expected: 에러/실패 없음.

- [ ] **Step 5: 커밋**

```bash
git add mobile/src/api/tasks.ts mobile/src/api/goals.ts mobile/src/components/TaskSheet.test.tsx mobile/src/screens/HomeScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat: 모바일 API 클라이언트에 리액션/추천 관련 타입과 함수 추가
EOF
)"
```

---

## Task 10: `TaskSheet.tsx`에 추천 UI 추가

**Files:**
- Modify: `mobile/src/components/TaskSheet.tsx`
- Test: `mobile/src/components/TaskSheet.test.tsx`

**Interfaces:**
- Consumes: `TaskSuggestion` from `../api/goals` (Task 9).
- Produces: `TaskSheet` props에 `suggestions`, `suggestionsLoading`, `onRequestSuggestions`, `onAcceptSuggestion`, `onRejectSuggestion` 추가(전부 기본값 있는 optional) — Task 12(HomeScreen)가 실제 값을 넘긴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/TaskSheet.test.tsx` 끝(`describe('TaskSheet', ...)` 블록의 마지막 `it` 다음)에 추가:

```ts
  it('requests suggestions when the button is pressed', () => {
    const onRequestSuggestions = jest.fn();
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        onRequestSuggestions={onRequestSuggestions}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('request-suggestions'));
    expect(onRequestSuggestions).toHaveBeenCalled();
  });

  it('shows suggestion cards and accepts one', () => {
    const onAcceptSuggestion = jest.fn();
    const suggestions = [{ title: '단어 암기', category: 'STUDY' as const, difficulty: 'MEDIUM' as const, dueChoice: 'TODAY' as const }];
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        suggestions={suggestions}
        onAcceptSuggestion={onAcceptSuggestion}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText(/단어 암기/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('suggestion-accept-0'));
    expect(onAcceptSuggestion).toHaveBeenCalledWith(suggestions[0]);
  });

  it('rejects a suggestion without calling onAcceptSuggestion', () => {
    const onAcceptSuggestion = jest.fn();
    const onRejectSuggestion = jest.fn();
    const suggestions = [{ title: '단어 암기', category: 'STUDY' as const, difficulty: 'MEDIUM' as const, dueChoice: 'TODAY' as const }];
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        suggestions={suggestions}
        onAcceptSuggestion={onAcceptSuggestion}
        onRejectSuggestion={onRejectSuggestion}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('suggestion-reject-0'));
    expect(onRejectSuggestion).toHaveBeenCalledWith(0);
    expect(onAcceptSuggestion).not.toHaveBeenCalled();
  });

  it('shows a loading label instead of the button while suggestions are loading', () => {
    render(
      <TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} suggestionsLoading />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText('추천받는 중...')).toBeTruthy();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/components/TaskSheet.test.tsx`
Expected: 새 4개 테스트 FAIL — `onRequestSuggestions` 등 prop이 없어 `testID="request-suggestions"` 엘리먼트를 못 찾음.

- [ ] **Step 3: 최소 구현**

`mobile/src/components/TaskSheet.tsx` 1~13번 줄을 다음으로 교체:

```tsx
import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Animated, Easing } from 'react-native';
import { Task, Category, Difficulty, DueChoice } from '../api/tasks';
import { TaskSuggestion } from '../api/goals';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  onCreate: (title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) => void;
  suggestions?: TaskSuggestion[];
  suggestionsLoading?: boolean;
  onRequestSuggestions?: () => void;
  onAcceptSuggestion?: (suggestion: TaskSuggestion) => void;
  onRejectSuggestion?: (index: number) => void;
}

const CATEGORIES: Category[] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export default function TaskSheet({
  tasks,
  onComplete,
  onCreate,
  suggestions = [],
  suggestionsLoading = false,
  onRequestSuggestions = () => {},
  onAcceptSuggestion = () => {},
  onRejectSuggestion = () => {},
}: Props) {
```

(나머지 함수 본문(`expanded` state부터 `handleCreate`까지, 14~40번 줄이었던 부분)은 그대로 둔다.)

`<TextInput testID="new-task-title" ... />` 바로 위(기존 104번째 줄 `<TouchableOpacity testID="add-task-submit" ...>` 앞, `due-choice-picker`의 `</View>` 다음)에 추천 섹션 추가:

```tsx
          <TouchableOpacity testID="request-suggestions" onPress={onRequestSuggestions} disabled={suggestionsLoading}>
            <Text>{suggestionsLoading ? '추천받는 중...' : '추천받기'}</Text>
          </TouchableOpacity>
          {suggestions.map((s, i) => (
            <View key={i} testID={`suggestion-card-${i}`}>
              <Text>{`${s.title} (${s.difficulty})`}</Text>
              <TouchableOpacity testID={`suggestion-accept-${i}`} onPress={() => onAcceptSuggestion(s)}>
                <Text>수락</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`suggestion-reject-${i}`} onPress={() => onRejectSuggestion(i)}>
                <Text>거절</Text>
              </TouchableOpacity>
            </View>
          ))}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/components/TaskSheet.test.tsx`
Expected: 전부 PASS (기존 5개 + 새 4개 = 9개).

- [ ] **Step 5: 타입체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/components/TaskSheet.tsx mobile/src/components/TaskSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat: TaskSheet에 추천받기 버튼과 추천 카드(수락/거절) UI 추가
EOF
)"
```

---

## Task 11: `ReactionModal` 컴포넌트

**Files:**
- Create: `mobile/src/components/ReactionModal.tsx`
- Test: `mobile/src/components/ReactionModal.test.tsx`

**Interfaces:**
- Produces: `ReactionModal({ visible, text, outcome, onDismiss }: { visible: boolean; text: string; outcome: 'COMPLETED' | 'FAILED'; onDismiss: () => void })` — Task 12(HomeScreen)가 이 컴포넌트를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/components/ReactionModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import ReactionModal from './ReactionModal';

describe('ReactionModal', () => {
  it('shows the reaction text and outcome label for a completion', () => {
    render(<ReactionModal visible text="정말 잘했어!" outcome="COMPLETED" onDismiss={() => {}} />);
    expect(screen.getByTestId('reaction-text')).toHaveTextContent('정말 잘했어!');
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('완료!');
  });

  it('shows the failure outcome label', () => {
    render(<ReactionModal visible text="괜찮아, 다음엔 잘할 거야" outcome="FAILED" onDismiss={() => {}} />);
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('아쉬워요');
  });

  it('calls onDismiss when the confirm button is pressed', () => {
    const onDismiss = jest.fn();
    render(<ReactionModal visible text="x" outcome="COMPLETED" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('reaction-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/components/ReactionModal.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현**

`mobile/src/components/ReactionModal.tsx`:

```tsx
import { Modal, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  text: string;
  outcome: 'COMPLETED' | 'FAILED';
  onDismiss: () => void;
}

export default function ReactionModal({ visible, text, outcome, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View testID="reaction-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16 }}>
          <Text testID="reaction-outcome-label">{outcome === 'COMPLETED' ? '완료!' : '아쉬워요'}</Text>
          <Text testID="reaction-text">{text}</Text>
          <TouchableOpacity testID="reaction-modal-dismiss" onPress={onDismiss}>
            <Text>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/components/ReactionModal.test.tsx`
Expected: 전부 PASS.

- [ ] **Step 5: 타입체크**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/components/ReactionModal.tsx mobile/src/components/ReactionModal.test.tsx
git commit -m "$(cat <<'EOF'
feat: 완료/실패 공용 ReactionModal 컴포넌트 추가

비주얼은 플레이스홀더 — 최종 디자인은 사용자가 별도로 입힌다.
EOF
)"
```

---

## Task 12: `HomeScreen.tsx` — 추천 요청 + 리액션 큐 연결

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`
- Test: `mobile/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `ackReaction` from `../api/tasks` (Task 9); `suggestTasks`, `TaskSuggestion` from `../api/goals` (Task 9); `ReactionModal` (Task 11).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/HomeScreen.test.tsx` 상단 mock 블록에 goals API mock 추가. 4번째 줄(`jest.mock('../api/growth');`) 다음에:

```ts
import * as goalsApi from '../api/goals';
jest.mock('../api/goals');
```

`beforeEach` 블록(55~62번 줄) 안에 추가:

```ts
  (goalsApi.suggestTasks as jest.Mock).mockResolvedValue([]);
  (tasksApi.ackReaction as jest.Mock).mockResolvedValue(undefined);
```

파일 끝, 마지막 `it` 다음에 추가:

```ts
  it('shows an immediate reaction modal after completing a task', async () => {
    (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED', reactionText: '잘했어!' });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('잘했어!'));
  });

  it('does not show a reaction modal when completeTask returns no reactionText', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalled());
    expect(screen.queryByTestId('reaction-modal')).toBeNull();
  });

  it('shows a queued reaction for a pending FAILED task on load, and acks it on dismiss', async () => {
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([
      { ...taskInGoalA, status: 'FAILED', reactionText: '괜찮아, 다음엔 잘할 거야', reactionShownAt: null },
    ]);
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('괜찮아, 다음엔 잘할 거야'));
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('아쉬워요');

    fireEvent.press(screen.getByTestId('reaction-modal-dismiss'));
    await waitFor(() => expect(tasksApi.ackReaction).toHaveBeenCalledWith('1'));
  });

  it('requests suggestions automatically when switching to a goal with no tasks', async () => {
    mockUseGoals.mockReturnValue({ goals, activeGoalId: 'goal-a', setActiveGoalId: mockSetActiveGoalId });
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalB]);
    render(<HomeScreen />);
    await waitFor(() => expect(goalsApi.suggestTasks).toHaveBeenCalledWith('goal-a'));
  });

  it('does not request suggestions when the active goal already has tasks', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    expect(goalsApi.suggestTasks).not.toHaveBeenCalled();
  });

  it('accepts a suggestion, creating a task and clearing the card', async () => {
    (goalsApi.suggestTasks as jest.Mock).mockResolvedValue([
      { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' },
    ]);
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalB]);
    render(<HomeScreen />);
    await waitFor(() => expect(goalsApi.suggestTasks).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('task-fab'));
    await waitFor(() => expect(screen.getByText(/단어 암기/)).toBeTruthy());
    fireEvent.press(screen.getByTestId('suggestion-accept-0'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('단어 암기', 'STUDY', 'MEDIUM', 'TODAY', 'goal-a')
    );
  });
```

- [ ] **Step 2: 실패 확인**

Run: `cd mobile && npx jest src/screens/HomeScreen.test.tsx`
Expected: 새 6개 테스트 FAIL — `ReactionModal`/추천 로직이 아직 없어 `reaction-text`, `suggestion-accept-0` 등을 못 찾거나 `suggestTasks`가 호출되지 않음.

- [ ] **Step 3: 최소 구현**

`mobile/src/screens/HomeScreen.tsx` 전체를 다음으로 교체:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask, ackReaction } from '../api/tasks';
import { GrowthState, getGrowth } from '../api/growth';
import { TaskSuggestion, suggestTasks } from '../api/goals';
import { useGoals } from '../context/GoalsContext';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import ReactionModal from '../components/ReactionModal';
import TaskSheet from '../components/TaskSheet';

export default function HomeScreen() {
  const { goals, activeGoalId, setActiveGoalId } = useGoals();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [reactionQueue, setReactionQueue] = useState<Task[]>([]);
  const [immediateReaction, setImmediateReaction] = useState<{ text: string; outcome: 'COMPLETED' | 'FAILED' } | null>(null);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [taskList, growthState] = await Promise.all([listTasks(), getGrowth()]);
      setTasks(taskList);
      setGrowth(growthState);
      setReactionQueue((current) =>
        current.length > 0 ? current : taskList.filter((t) => t.reactionText && !t.reactionShownAt)
      );
    } catch {
      setError('불러오지 못했어요');
    } finally {
      setTasksLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRequestSuggestions = useCallback(async () => {
    if (!activeGoalId) return;
    setSuggestionsLoading(true);
    try {
      const result = await suggestTasks(activeGoalId);
      setSuggestions(result);
    } catch {
      setError('지금은 추천을 가져올 수 없어요, 다시 시도해주세요');
    } finally {
      setSuggestionsLoading(false);
    }
  }, [activeGoalId]);

  useEffect(() => {
    if (!tasksLoaded || !activeGoalId) return;
    const hasTasksForGoal = tasks.some((t) => t.goalId === activeGoalId);
    if (!hasTasksForGoal && suggestions.length === 0 && !suggestionsLoading) {
      handleRequestSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoalId, tasksLoaded]);

  async function handleComplete(id: string) {
    let failureMessage = '';
    try {
      const completed = await completeTask(id);
      if (completed.reactionText) {
        setImmediateReaction({ text: completed.reactionText, outcome: 'COMPLETED' });
      }
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
      await createTask(title, category, difficulty, dueChoice, activeGoalId ?? undefined);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  async function handleAcceptSuggestion(s: TaskSuggestion) {
    setSuggestions((current) => current.filter((x) => x !== s));
    try {
      await createTask(s.title, s.category, s.difficulty, s.dueChoice, activeGoalId ?? undefined);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  function handleRejectSuggestion(index: number) {
    setSuggestions((current) => current.filter((_, i) => i !== index));
  }

  async function handleDismissQueuedReaction() {
    const [current, ...rest] = reactionQueue;
    if (!current) return;
    setReactionQueue(rest);
    try {
      await ackReaction(current.id);
    } catch {
      // best-effort — ack 실패 시 다음 refresh에서 다시 큐에 나타날 수 있다.
    }
  }

  const visibleTasks = tasks.filter((t) => t.goalId === activeGoalId);
  const queuedReaction = reactionQueue[0];
  const activeReaction =
    immediateReaction ?? (queuedReaction ? { text: queuedReaction.reactionText!, outcome: 'FAILED' as const } : null);

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
      {activeReaction ? (
        <ReactionModal
          visible
          text={activeReaction.text}
          outcome={activeReaction.outcome}
          onDismiss={immediateReaction ? () => setImmediateReaction(null) : handleDismissQueuedReaction}
        />
      ) : null}
      <TaskSheet
        tasks={visibleTasks}
        onComplete={handleComplete}
        onCreate={handleCreate}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        onRequestSuggestions={handleRequestSuggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion}
      />
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd mobile && npx jest src/screens/HomeScreen.test.tsx`
Expected: 전부 PASS (기존 8개 + 새 6개 = 14개).

- [ ] **Step 5: 전체 테스트 + 타입체크**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: 전부 PASS. 이 시점에서 서브프로젝트 4 구현이 전부 끝난다.

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/HomeScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat: HomeScreen에 AI 할일 추천과 완료/실패 리액션 모달 연결

목표에 태스크가 없을 때 자동으로 추천을 요청하고, 완료 시 즉시 리액션을
보여준다. 마감 지나 실패한 태스크의 리액션은 큐에 쌓아 순차적으로 보여주고
확인할 때마다 서버에 ack한다.
EOF
)"
```

---

## 최종 확인

- [ ] **전체 회귀 테스트**

Run:
```bash
cd backend && npm test && npx tsc --noEmit
cd ../mobile && npm test && npx tsc --noEmit
```

Expected: 백엔드/모바일 모두 전체 테스트 그린, `tsc --noEmit` 클린. 이걸로 서브프로젝트 4(AI 할일 추천 + 완료/실패 리액션 대화)가 `docs/superpowers/specs/2026-07-19-ai-task-suggestion-reaction-design.md`에 정의된 범위대로 전부 구현된 상태다.
