# 그로우미(GrowMe) MVP 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타이머로 몰입시간을 인증하면 캐릭터 "꾸미"가 성장·퇴화하는 그로우미 MVP를 구현한다.

**Architecture:** React(Vite, TS) SPA 프론트엔드 + Node.js/Express(TS) REST API 백엔드 + PostgreSQL(Prisma ORM) 단일 DB. 모놀리식 구조, 별도 캐시/큐 없음.

**Tech Stack:** TypeScript, React 18 + Vite + React Router, Node.js + Express, Prisma + PostgreSQL, JWT(jsonwebtoken) + bcrypt, Google OAuth(google-auth-library) + Kakao OAuth(REST API), node-cron, Vitest(+ supertest, React Testing Library).

## Global Constraints

- 혼자 3~4개월 안에 MVP 출시 가능한 범위 — 오버엔지니어링 금지, 확장 포인트는 표시만 하고 구현하지 않는다.
- 무료/저비용 티어 우선, 유료 외부 서비스(특히 유료 AI) 의존 금지.
- 언어: TypeScript (프론트/백엔드 모두).
- ORM: Prisma. DB: PostgreSQL 단일 인스턴스.
- 테스트: Vitest. 백엔드는 실제 로컬 Postgres 테스트 DB에 대해 통합테스트, 프론트는 jsdom + React Testing Library.
- 코드에는 "왜"가 비자명한 경우에만 짧은 주석. 장황한 설명 주석 금지.
- 커밋은 기능 단위로 작게, 매 태스크 끝에 커밋.
- 카테고리 프리셋은 고정 4종(EXERCISE/STUDY/READING/ETC), 자유 텍스트 카테고리 없음.
- 캐릭터 성장 단계는 알 포함 5단계(0~4), 정확한 시간 구간은 이 계획에서 확정해 사용한다(설계 문서상 "구현 단계에서 밸런싱"으로 남겨둔 부분).

---

## 사전 준비 (태스크 시작 전에 1회)

로컬에 PostgreSQL이 설치되어 있어야 한다 (또는 Supabase/Neon 무료 티어에 개발용 DB 1개 + 테스트용 DB 1개 생성). 데이터베이스 2개를 만든다: `growme_dev`, `growme_test`.

---

### Task 1: 백엔드 스캐폴드 + Prisma 스키마

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/.env` (로컬 전용, git에 커밋 안 함)
- Create: `backend/.env.test` (로컬 전용, git에 커밋 안 함)
- Create: `backend/.gitignore`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`
- Create: `backend/src/constants.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/tests/setup.ts`
- Test: `backend/src/app.test.ts`

**Interfaces:**
- Produces: `prisma`(Prisma client 싱글턴, `src/db.ts`), `app`(Express 인스턴스, `src/app.ts`의 default export), `HEARTBEAT_INTERVAL_SECONDS`/`MAX_GAP_SECONDS`/`STAGE_THRESHOLDS`/`DECAY_START_DAYS`/`DECAY_RATE`(`src/constants.ts`). 이후 모든 태스크가 `prisma`와 `app`을 가져다 쓴다.

- [ ] **Step 1: 프로젝트 파일 생성**

`backend/package.json`:
```json
{
  "name": "growme-backend",
  "version": "0.1.0",
  "type": "commonjs",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "cross-env NODE_ENV=test vitest run",
    "test:setup": "cross-env DATABASE_URL=$TEST_DATABASE_URL prisma db push --skip-generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "google-auth-library": "^9.14.1",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.16.10",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^6.0.2",
    "cross-env": "^7.0.3",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.2",
    "vitest": "^2.1.1"
  }
}
```

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

`backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
  },
});
```

`backend/.gitignore`:
```
node_modules/
dist/
.env
.env.test
```

`backend/.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/growme_dev"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/growme_test"
JWT_SECRET="change-me-in-production"
GOOGLE_CLIENT_ID=""
KAKAO_REST_API_KEY=""
PORT=4000
```

`backend/.env`와 `backend/.env.test`는 위 예시를 복사해서 각자 로컬 Postgres 접속정보로 채운다 (`.env.test`의 DATABASE_URL은 `growme_test` DB를 가리키도록 `TEST_DATABASE_URL`과 동일한 값으로 맞춘다).

`backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Category {
  EXERCISE
  STUDY
  READING
  ETC
}

model User {
  id            String   @id @default(uuid())
  email         String?  @unique
  passwordHash  String?
  oauthProvider String?
  oauthId       String?
  nickname      String
  createdAt     DateTime @default(now())

  activities Activity[]
  sessions   Session[]
  growth     Growth?

  @@unique([oauthProvider, oauthId])
}

model Activity {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  category  Category
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  sessions Session[]
}

model Session {
  id              String    @id @default(uuid())
  activityId      String
  activity        Activity  @relation(fields: [activityId], references: [id])
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  verifiedSeconds Int       @default(0)
  lastHeartbeatAt DateTime  @default(now())
  createdAt       DateTime  @default(now())
}

model Growth {
  id             String   @id @default(uuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  currentGauge   Int      @default(0)
  lastActiveDate DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

`backend/src/constants.ts`:
```ts
export const HEARTBEAT_INTERVAL_SECONDS = 30;
export const MAX_GAP_SECONDS = 300; // 5분 이상 끊기면 그 이후는 인증 안 함
export const DECAY_START_DAYS = 3; // 3일째부터 하락 시작 (2일 연속 무기록 후)
export const DECAY_RATE = 0.1; // 하루당 10% 감소
export const STAGE_THRESHOLDS = [0, 3600, 3 * 3600, 10 * 3600, 30 * 3600]; // 알,1,2,3,4단계 (초)
```

`backend/src/db.ts`:
```ts
import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

`backend/src/app.ts`:
```ts
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

`backend/src/server.ts`:
```ts
import app from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`growme backend listening on ${PORT}`);
});
```

`backend/tests/setup.ts`:
```ts
import { execSync } from 'child_process';
import { beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db';

beforeAll(() => {
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit',
  });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Session","Activity","Growth","User" CASCADE'
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 2: 의존성 설치 및 Prisma client 생성**

Run: `cd backend && npm install && npx prisma generate`
Expected: `node_modules`와 `node_modules/.prisma/client`가 생성됨, 에러 없음.

- [ ] **Step 3: 실패하는 테스트 작성**

`backend/src/app.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from './app';

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: 테스트 실행 → 실패 확인 (DB push 전이라 setup 단계에서 실패해도 정상)**

Run: `cd backend && npm test`
Expected: `app.ts`가 아직 없으면 컴파일 에러, 있어도 DB push가 안 되어 있으면 setup에서 실패. `.env.test`의 DB 접속정보를 확인하고 Postgres가 켜져 있는지 확인.

- [ ] **Step 5: 통과할 때까지 수정 후 재실행**

Run: `cd backend && npm test`
Expected: `PASS src/app.test.ts (1 test)`

- [ ] **Step 6: 커밋**

```bash
git add backend/
git commit -m "feat: 백엔드 스캐폴드 + Prisma 스키마 추가"
```

---

### Task 2: 프론트엔드 스캐폴드

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/router.tsx`
- Create: `frontend/src/pages/HomePage.tsx` (임시 자리표시자, Task 14에서 완성)
- Create: `frontend/.gitignore`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `AppRouter`(`src/router.tsx`의 default export) — 이후 태스크가 라우트를 추가할 때 이 파일을 수정한다.

- [ ] **Step 1: 프로젝트 파일 생성**

`frontend/package.json`:
```json
{
  "name": "growme-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

`frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

`frontend/src/setupTests.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>그로우미</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`frontend/src/pages/HomePage.tsx`:
```tsx
export default function HomePage() {
  return <div>그로우미 홈</div>;
}
```

`frontend/src/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
]);

export default router;
```

`frontend/src/App.tsx`:
```tsx
import { RouterProvider } from 'react-router-dom';
import router from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

`frontend/.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 2: 의존성 설치**

Run: `cd frontend && npm install`
Expected: 에러 없이 설치 완료.

- [ ] **Step 3: 실패하는 테스트 작성**

`frontend/src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the home page', () => {
    render(<App />);
    expect(screen.getByText('그로우미 홈')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test`
Expected: 파일이 없으면 실패, 있다면 이미 통과할 수 있음 — 이 경우 Step 5로 넘어감.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npm test`
Expected: `PASS src/App.test.tsx (1 test)`

- [ ] **Step 6: 커밋**

```bash
git add frontend/
git commit -m "feat: 프론트엔드 스캐폴드 추가"
```

---

### Task 3: 회원가입/로그인 (이메일+비밀번호)

**Files:**
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/routes/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`(`src/db.ts`)
- Produces: `authRouter`(default export of `src/routes/auth.ts`), 마운트 경로 `/api/auth`. `POST /api/auth/signup`, `POST /api/auth/login` 모두 `{ token: string, user: { id, email, nickname } }` 형태로 응답.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/auth.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

describe('POST /api/auth/signup', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'password123',
      nickname: '테스터',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'dup@example.com',
      password: 'password123',
      nickname: 'A',
    });
    const res = await request(app).post('/api/auth/signup').send({
      email: 'dup@example.com',
      password: 'password123',
      nickname: 'B',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'login@example.com',
      password: 'password123',
      nickname: '로그인테스트',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'wrong@example.com',
      password: 'password123',
      nickname: 'C',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'wrong@example.com',
      password: 'wrongpass',
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/auth.test.ts`
Expected: FAIL — `Cannot find module '../routes/auth'` 또는 라우트 미마운트로 404.

- [ ] **Step 3: 구현**

`backend/src/routes/auth.ts`:
```ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();

function issueToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'email already registered' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, nickname },
  });
  const token = issueToken(user.id);
  res.status(201).json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = issueToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import authRouter from './routes/auth';
// ... app.use(express.json()); 다음 줄에 추가
app.use('/api/auth', authRouter);
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/auth.test.ts`
Expected: `PASS` (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/routes/auth.ts backend/src/app.ts backend/src/routes/auth.test.ts
git commit -m "feat: 이메일 회원가입/로그인 API 추가"
```

---

### Task 4: JWT 인증 미들웨어

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Test: `backend/src/middleware/auth.test.ts`

**Interfaces:**
- Consumes: `JWT_SECRET` env var
- Produces: `requireAuth`(named export, Express middleware) — `req.userId: string`를 설정. 이후 모든 보호된 라우트가 이 미들웨어를 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/middleware/auth.test.ts`:
```ts
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll } from 'vitest';
import { requireAuth } from './auth';

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ userId: (req as any).userId });
  });
  return app;
}

describe('requireAuth', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  });

  it('rejects requests without a token', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('accepts requests with a valid token', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET!);
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-1');
  });

  it('rejects invalid tokens', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/middleware/auth.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`backend/src/middleware/auth.ts`:
```ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/middleware/auth.test.ts`
Expected: `PASS` (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/middleware/auth.ts backend/src/middleware/auth.test.ts
git commit -m "feat: JWT 인증 미들웨어 추가"
```

---

### Task 5: Google 소셜로그인

**Files:**
- Create: `backend/src/routes/oauthGoogle.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/auth.ts` (find-or-create 로직을 공용 함수로 분리)
- Test: `backend/src/routes/oauthGoogle.test.ts`

**Interfaces:**
- Consumes: `prisma`, `issueToken` 방식(auth.ts에서 `export function issueToken` 하도록 수정)
- Produces: `POST /api/auth/google` — `{ idToken }` 받아 `{ token, user }` 응답.

- [ ] **Step 1: auth.ts에서 issueToken export**

`backend/src/routes/auth.ts`에서 `function issueToken`을 `export function issueToken`으로 변경.

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/src/routes/oauthGoogle.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import app from '../app';

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({ sub: 'google-user-1', email: 'g@example.com', name: '구글유저' }),
      }),
    })),
  };
});

describe('POST /api/auth/google', () => {
  it('creates a new user on first login', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.nickname).toBe('구글유저');
  });

  it('logs in the same user on second login', async () => {
    await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake' });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/oauthGoogle.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

`backend/src/routes/oauthGoogle.ts`:
```ts
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db';
import { issueToken } from './auth';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload) {
    return res.status(401).json({ error: 'invalid google token' });
  }
  const user = await prisma.user.upsert({
    where: { oauthProvider_oauthId: { oauthProvider: 'google', oauthId: payload.sub } },
    create: {
      oauthProvider: 'google',
      oauthId: payload.sub,
      email: payload.email,
      nickname: payload.name ?? '구글유저',
    },
    update: {},
  });
  const token = issueToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import oauthGoogleRouter from './routes/oauthGoogle';
app.use('/api/auth', oauthGoogleRouter);
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/oauthGoogle.test.ts`
Expected: `PASS` (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/oauthGoogle.ts backend/src/routes/auth.ts backend/src/app.ts backend/src/routes/oauthGoogle.test.ts
git commit -m "feat: Google 소셜로그인 추가"
```

---

### Task 6: Kakao 소셜로그인

**Files:**
- Create: `backend/src/routes/oauthKakao.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/package.json` (axios 의존성 추가)
- Test: `backend/src/routes/oauthKakao.test.ts`

**Interfaces:**
- Consumes: `prisma`, `issueToken`
- Produces: `POST /api/auth/kakao` — `{ accessToken }` 받아 `{ token, user }` 응답.

- [ ] **Step 1: axios 설치**

Run: `cd backend && npm install axios`
Expected: `package.json`의 dependencies에 axios 추가됨.

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/src/routes/oauthKakao.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import app from '../app';

vi.mock('axios');

describe('POST /api/auth/kakao', () => {
  it('creates a new user from kakao profile', async () => {
    (axios.get as any).mockResolvedValue({
      data: {
        id: 123456,
        kakao_account: { email: 'k@example.com', profile: { nickname: '카카오유저' } },
      },
    });
    const res = await request(app).post('/api/auth/kakao').send({ accessToken: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe('카카오유저');
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/oauthKakao.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

`backend/src/routes/oauthKakao.ts`:
```ts
import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../db';
import { issueToken } from './auth';

const router = Router();

router.post('/kakao', async (req, res) => {
  const { accessToken } = req.body;
  const profileRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const kakaoId = String(profileRes.data.id);
  const account = profileRes.data.kakao_account ?? {};
  const user = await prisma.user.upsert({
    where: { oauthProvider_oauthId: { oauthProvider: 'kakao', oauthId: kakaoId } },
    create: {
      oauthProvider: 'kakao',
      oauthId: kakaoId,
      email: account.email,
      nickname: account.profile?.nickname ?? '카카오유저',
    },
    update: {},
  });
  const token = issueToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname } });
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import oauthKakaoRouter from './routes/oauthKakao';
app.use('/api/auth', oauthKakaoRouter);
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/oauthKakao.test.ts`
Expected: `PASS` (1 test)

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/oauthKakao.ts backend/src/app.ts backend/package.json backend/src/routes/oauthKakao.test.ts
git commit -m "feat: Kakao 소셜로그인 추가"
```

---

### Task 7: 프론트엔드 로그인/회원가입 페이지 + 인증 상태

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Produces: `useAuth()`(`AuthContext.tsx`, `{ token, login, logout }` 반환), `signup`/`login`(`api/auth.ts`, `fetch` 래퍼) — 이후 모든 인증 필요 페이지가 `useAuth()`로 토큰을 읽는다.

- [ ] **Step 1: API 클라이언트 작성**

`frontend/src/api/client.ts`:
```ts
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('growme_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  return res;
}
```

`frontend/src/api/auth.ts`:
```ts
import { apiFetch } from './client';

export async function login(email: string, password: string) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('login failed');
  return res.json();
}

export async function signup(email: string, password: string, nickname: string) {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) throw new Error('signup failed');
  return res.json();
}
```

`frontend/src/context/AuthContext.tsx`:
```tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('growme_token'));

  const login = (newToken: string) => {
    localStorage.setItem('growme_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('growme_token');
    setToken(null);
  };

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/pages/LoginPage.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  it('submits email and password to login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'abc', user: { id: '1', email: 'a@b.com', nickname: 'A' } }),
    }) as any;

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('로그인'));

    await waitFor(() => {
      expect(localStorage.getItem('growme_token')).toBe('abc');
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test -- src/pages/LoginPage.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

`frontend/src/pages/LoginPage.tsx`:
```tsx
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const { token } = await loginApi(email, password);
      login(token);
      navigate('/');
    } catch {
      setError('로그인에 실패했어요');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">이메일</label>
      <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">비밀번호</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">로그인</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

`frontend/src/router.tsx` 수정:
```tsx
import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
]);

export default router;
```

`frontend/src/App.tsx` 수정:
```tsx
import { RouterProvider } from 'react-router-dom';
import router from './router';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
```

`label`과 `input`을 연결하려면 `htmlFor`/`id` 외에 접근성을 위해 `input`에 `aria-label`도 동일하게 둘 필요는 없음 — `getByLabelText`는 `htmlFor`/`id` 매칭으로 충분히 찾는다.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npm test -- src/pages/LoginPage.test.tsx`
Expected: `PASS` (1 test)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src
git commit -m "feat: 로그인 페이지와 인증 컨텍스트 추가"
```

---

### Task 8: 활동(Activity) CRUD API

**Files:**
- Create: `backend/src/routes/activities.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/routes/activities.test.ts`

**Interfaces:**
- Consumes: `requireAuth`(`middleware/auth.ts`), `prisma`
- Produces: `POST /api/activities`, `GET /api/activities`, `DELETE /api/activities/:id` (soft delete, `deletedAt` 설정). 이후 세션 API가 `activityId` 유효성 검사에 이 라우트가 만든 데이터를 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/activities.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

async function signupAndGetToken(email: string) {
  const res = await request(app).post('/api/auth/signup').send({
    email,
    password: 'password123',
    nickname: '테스터',
  });
  return res.body.token as string;
}

describe('Activity CRUD', () => {
  it('creates and lists activities scoped to the user', async () => {
    const token = await signupAndGetToken('act1@example.com');
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '알고리즘 스터디', category: 'STUDY' });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('알고리즘 스터디');
  });

  it('does not list another user activities', async () => {
    const tokenA = await signupAndGetToken('act2@example.com');
    const tokenB = await signupAndGetToken('act3@example.com');
    await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A의 활동', category: 'EXERCISE' });

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('soft-deletes an activity, excluding it from the list', async () => {
    const token = await signupAndGetToken('act4@example.com');
    const createRes = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '삭제될 활동', category: 'ETC' });
    const activityId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/activities/${activityId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/activities.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`backend/src/routes/activities.ts`:
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, category } = req.body;
  const activity = await prisma.activity.create({
    data: { userId: req.userId!, name, category },
  });
  res.status(201).json(activity);
});

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const activities = await prisma.activity.findMany({
    where: { userId: req.userId!, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json(activities);
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const activity = await prisma.activity.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!activity) {
    return res.status(404).json({ error: 'activity not found' });
  }
  await prisma.activity.update({
    where: { id: activity.id },
    data: { deletedAt: new Date() },
  });
  res.status(204).send();
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import activitiesRouter from './routes/activities';
app.use('/api/activities', activitiesRouter);
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/activities.test.ts`
Expected: `PASS` (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/routes/activities.ts backend/src/app.ts backend/src/routes/activities.test.ts
git commit -m "feat: 활동(Activity) CRUD API 추가"
```

---

### Task 9: 프론트엔드 활동 선택/생성 페이지

**Files:**
- Create: `frontend/src/api/activities.ts`
- Create: `frontend/src/pages/ActivitySelectPage.tsx`
- Modify: `frontend/src/router.tsx`
- Test: `frontend/src/pages/ActivitySelectPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`(`api/client.ts`)
- Produces: `listActivities`/`createActivity`(`api/activities.ts`) — Task 11의 타이머 페이지가 선택된 `activityId`를 받아 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/pages/ActivitySelectPage.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActivitySelectPage from './ActivitySelectPage';

describe('ActivitySelectPage', () => {
  it('lists existing activities and creates a new one', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'a1', name: '독서', category: 'READING' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'a2', name: '새 활동', category: 'ETC' }),
      });

    render(
      <MemoryRouter>
        <ActivitySelectPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('독서')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('활동 이름'), { target: { value: '새 활동' } });
    fireEvent.click(screen.getByText('활동 만들기'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test -- src/pages/ActivitySelectPage.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`frontend/src/api/activities.ts`:
```ts
import { apiFetch } from './client';

export interface Activity {
  id: string;
  name: string;
  category: 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
}

export async function listActivities(): Promise<Activity[]> {
  const res = await apiFetch('/api/activities');
  return res.json();
}

export async function createActivity(name: string, category: Activity['category']): Promise<Activity> {
  const res = await apiFetch('/api/activities', {
    method: 'POST',
    body: JSON.stringify({ name, category }),
  });
  return res.json();
}
```

`frontend/src/pages/ActivitySelectPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, listActivities, createActivity } from '../api/activities';

const CATEGORIES: Activity['category'][] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];

export default function ActivitySelectPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Activity['category']>('ETC');
  const navigate = useNavigate();

  useEffect(() => {
    listActivities().then(setActivities);
  }, []);

  async function handleCreate() {
    const created = await createActivity(name, category);
    setActivities((prev) => [...prev, created]);
    setName('');
  }

  return (
    <div>
      <ul>
        {activities.map((a) => (
          <li key={a.id}>
            <button onClick={() => navigate(`/timer/${a.id}`)}>{a.name}</button>
          </li>
        ))}
      </ul>
      <label htmlFor="activity-name">활동 이름</label>
      <input id="activity-name" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value as Activity['category'])}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button onClick={handleCreate}>활동 만들기</button>
    </div>
  );
}
```

`frontend/src/router.tsx`에 라우트 추가:
```tsx
import ActivitySelectPage from './pages/ActivitySelectPage';
// routes 배열에 추가
{ path: '/activities', element: <ActivitySelectPage /> },
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npm test -- src/pages/ActivitySelectPage.test.tsx`
Expected: `PASS` (1 test)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src
git commit -m "feat: 활동 선택/생성 페이지 추가"
```

---

### Task 10: 타이머 세션 API (시작/heartbeat/종료 + 방치 세션 자동 종료)

**Files:**
- Create: `backend/src/services/growth.ts` (Task 12에서 완성할 자리표시자 — 여기서는 `applySessionToGrowth`만 최소 구현)
- Create: `backend/src/routes/sessions.ts`
- Create: `backend/src/jobs/staleSessionJob.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/cron.ts` (없으면 생성)
- Modify: `backend/src/server.ts`
- Test: `backend/src/routes/sessions.test.ts`
- Test: `backend/src/jobs/staleSessionJob.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `prisma`, `HEARTBEAT_INTERVAL_SECONDS`/`MAX_GAP_SECONDS`(`constants.ts`)
- Produces: `POST /api/sessions/start`, `POST /api/sessions/:id/heartbeat`, `POST /api/sessions/:id/end`. `applySessionToGrowth(userId, verifiedSeconds)`(`services/growth.ts`) — Task 12가 이 함수의 로직을 확장.

- [ ] **Step 1: growth 서비스 최소 구현**

`backend/src/services/growth.ts`:
```ts
import { prisma } from '../db';

export async function applySessionToGrowth(userId: string, verifiedSeconds: number) {
  const existing = await prisma.growth.findUnique({ where: { userId } });
  const newGauge = (existing?.currentGauge ?? 0) + verifiedSeconds;
  await prisma.growth.upsert({
    where: { userId },
    create: { userId, currentGauge: newGauge, lastActiveDate: new Date() },
    update: { currentGauge: newGauge, lastActiveDate: new Date() },
  });
}
```

- [ ] **Step 2: 실패하는 테스트 작성 (세션 API)**

`backend/src/routes/sessions.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../app';
import { prisma } from '../db';

async function setupUserAndActivity() {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: `s${Date.now()}@example.com`,
    password: 'password123',
    nickname: '테스터',
  });
  const token = signupRes.body.token;
  const activityRes = await request(app)
    .post('/api/activities')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '집중', category: 'STUDY' });
  return { token, activityId: activityRes.body.id };
}

describe('Session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a session', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('accumulates verified seconds on heartbeat', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(30_000);
    const hbRes = await request(app)
      .post(`/api/sessions/${sessionId}/heartbeat`)
      .set('Authorization', `Bearer ${token}`);
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.verifiedSeconds).toBeGreaterThanOrEqual(29);
  });

  it('ends a session and updates growth gauge', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(60_000);
    const endRes = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(endRes.status).toBe(200);
    expect(endRes.body.verifiedSeconds).toBeGreaterThanOrEqual(59);

    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    const growth = await prisma.growth.findUnique({ where: { userId: decoded.userId } });
    expect(growth?.currentGauge).toBeGreaterThanOrEqual(59);
  });

  it('caps the counted gap at 5 minutes', async () => {
    const { token, activityId } = await setupUserAndActivity();
    const startRes = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityId });
    const sessionId = startRes.body.id;

    vi.advanceTimersByTime(20 * 60_000); // 20분 방치
    const endRes = await request(app)
      .post(`/api/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(endRes.body.verifiedSeconds).toBeLessThanOrEqual(300);
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/sessions.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현 (세션 라우트)**

`backend/src/routes/sessions.ts`:
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { applySessionToGrowth } from '../services/growth';
import { MAX_GAP_SECONDS } from '../constants';

const router = Router();

router.post('/start', requireAuth, async (req: AuthedRequest, res) => {
  const { activityId } = req.body;
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
});

router.post('/:id/heartbeat', requireAuth, async (req: AuthedRequest, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.userId!, endedAt: null },
  });
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }
  const now = new Date();
  const gapSeconds = Math.min(
    (now.getTime() - session.lastHeartbeatAt.getTime()) / 1000,
    MAX_GAP_SECONDS
  );
  const verifiedSeconds = session.verifiedSeconds + Math.round(gapSeconds);
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { verifiedSeconds, lastHeartbeatAt: now },
  });
  res.json({ verifiedSeconds: updated.verifiedSeconds });
});

router.post('/:id/end', requireAuth, async (req: AuthedRequest, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.userId!, endedAt: null },
  });
  if (!session) {
    return res.status(404).json({ error: 'session not found or already ended' });
  }
  const now = new Date();
  const gapSeconds = Math.min(
    (now.getTime() - session.lastHeartbeatAt.getTime()) / 1000,
    MAX_GAP_SECONDS
  );
  const verifiedSeconds = session.verifiedSeconds + Math.round(gapSeconds);
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt: now, verifiedSeconds, lastHeartbeatAt: now },
  });
  await applySessionToGrowth(req.userId!, updated.verifiedSeconds);
  res.json({ verifiedSeconds: updated.verifiedSeconds });
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import sessionsRouter from './routes/sessions';
app.use('/api/sessions', sessionsRouter);
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/sessions.test.ts`
Expected: `PASS` (4 tests)

- [ ] **Step 6: 방치 세션 자동 종료 잡 — 실패하는 테스트 작성**

`backend/src/jobs/staleSessionJob.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { closeStaleSessions } from './staleSessionJob';

describe('closeStaleSessions', () => {
  it('closes sessions with no heartbeat for over 5 minutes', async () => {
    const user = await prisma.user.create({
      data: { email: 'stale@example.com', passwordHash: 'x', nickname: '방치테스터' },
    });
    const activity = await prisma.activity.create({
      data: { userId: user.id, name: '방치활동', category: 'ETC' },
    });
    const staleTime = new Date(Date.now() - 10 * 60_000);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        activityId: activity.id,
        verifiedSeconds: 120,
        lastHeartbeatAt: staleTime,
        startedAt: staleTime,
      },
    });

    await closeStaleSessions();

    const updated = await prisma.session.findUnique({ where: { id: session.id } });
    expect(updated?.endedAt).not.toBeNull();

    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth?.currentGauge).toBe(120);
  });
});
```

- [ ] **Step 7: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/jobs/staleSessionJob.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 8: 구현 (방치 세션 잡 + cron 등록)**

`backend/src/jobs/staleSessionJob.ts`:
```ts
import { prisma } from '../db';
import { applySessionToGrowth } from '../services/growth';
import { MAX_GAP_SECONDS } from '../constants';

export async function closeStaleSessions() {
  const threshold = new Date(Date.now() - MAX_GAP_SECONDS * 1000);
  const staleSessions = await prisma.session.findMany({
    where: { endedAt: null, lastHeartbeatAt: { lt: threshold } },
  });
  for (const session of staleSessions) {
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { endedAt: session.lastHeartbeatAt },
    });
    await applySessionToGrowth(session.userId, updated.verifiedSeconds);
  }
}
```

`backend/src/cron.ts`:
```ts
import cron from 'node-cron';
import { closeStaleSessions } from './jobs/staleSessionJob';

export function registerCronJobs() {
  cron.schedule('*/5 * * * *', closeStaleSessions);
}
```

`backend/src/server.ts` 수정:
```ts
import app from './app';
import { registerCronJobs } from './cron';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`growme backend listening on ${PORT}`);
  registerCronJobs();
});
```

- [ ] **Step 9: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/jobs/staleSessionJob.test.ts`
Expected: `PASS` (1 test)

- [ ] **Step 10: 커밋**

```bash
git add backend/src
git commit -m "feat: 타이머 세션 API와 방치 세션 자동 종료 잡 추가"
```

---

### Task 11: 프론트엔드 타이머 UI

**Files:**
- Create: `frontend/src/api/sessions.ts`
- Create: `frontend/src/hooks/useFocusTimer.ts`
- Create: `frontend/src/pages/TimerPage.tsx`
- Modify: `frontend/src/router.tsx`
- Test: `frontend/src/hooks/useFocusTimer.test.ts`

**Interfaces:**
- Consumes: `apiFetch`
- Produces: `useFocusTimer(activityId)` 훅 — `{ elapsedSeconds, isPaused, end }` 반환. `startSession`/`sendHeartbeat`/`endSession`(`api/sessions.ts`).

- [ ] **Step 1: 세션 API 클라이언트**

`frontend/src/api/sessions.ts`:
```ts
import { apiFetch } from './client';

export async function startSession(activityId: string): Promise<{ id: string }> {
  const res = await apiFetch('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ activityId }),
  });
  return res.json();
}

export async function sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/heartbeat`, { method: 'POST' });
  return res.json();
}

export async function endSession(sessionId: string): Promise<{ verifiedSeconds: number }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
  return res.json();
}
```

- [ ] **Step 2: 실패하는 테스트 작성 (훅)**

`frontend/src/hooks/useFocusTimer.test.ts`:
```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sessionsApi from '../api/sessions';
import { useFocusTimer } from './useFocusTimer';

vi.mock('../api/sessions');

describe('useFocusTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (sessionsApi.startSession as any).mockResolvedValue({ id: 'session-1' });
    (sessionsApi.sendHeartbeat as any).mockResolvedValue({ verifiedSeconds: 30 });
    (sessionsApi.endSession as any).mockResolvedValue({ verifiedSeconds: 60 });
  });

  it('starts a session and sends heartbeats every 30 seconds', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));

    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalledWith('activity-1'));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(sessionsApi.sendHeartbeat).toHaveBeenCalledWith('session-1');
  });

  it('does not send heartbeats while the tab is hidden', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));
    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalled());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(sessionsApi.sendHeartbeat).not.toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
  });

  it('ends the session when end() is called', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));
    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalled());

    let finalSeconds = 0;
    await act(async () => {
      finalSeconds = await result.current.end();
    });

    expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1');
    expect(finalSeconds).toBe(60);
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test -- src/hooks/useFocusTimer.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

`frontend/src/hooks/useFocusTimer.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import { startSession, sendHeartbeat, endSession } from '../api/sessions';

const HEARTBEAT_MS = 30_000;

export function useFocusTimer(activityId: string) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startSession(activityId).then(({ id }) => {
      if (!cancelled) sessionIdRef.current = id;
    });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsPaused(document.visibilityState === 'hidden');
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (isPaused || !sessionIdRef.current) return;
      const { verifiedSeconds } = await sendHeartbeat(sessionIdRef.current);
      setElapsedSeconds(verifiedSeconds);
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [isPaused]);

  async function end() {
    if (!sessionIdRef.current) return 0;
    const { verifiedSeconds } = await endSession(sessionIdRef.current);
    setElapsedSeconds(verifiedSeconds);
    return verifiedSeconds;
  }

  return { elapsedSeconds, isPaused, end };
}
```

`frontend/src/pages/TimerPage.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFocusTimer } from '../hooks/useFocusTimer';

export default function TimerPage() {
  const { activityId } = useParams();
  const { elapsedSeconds, isPaused, end } = useFocusTimer(activityId!);
  const [result, setResult] = useState<number | null>(null);
  const navigate = useNavigate();

  async function handleEnd() {
    const finalSeconds = await end();
    setResult(finalSeconds);
  }

  if (result !== null) {
    return (
      <div>
        <p>이번 세션 인증 시간: {result}초</p>
        <button onClick={() => navigate('/')}>홈으로</button>
      </div>
    );
  }

  return (
    <div>
      <p>{isPaused ? '일시정지됨' : '진행 중'}</p>
      <p>{elapsedSeconds}초</p>
      <button onClick={handleEnd}>종료</button>
    </div>
  );
}
```

`frontend/src/router.tsx`에 라우트 추가:
```tsx
import TimerPage from './pages/TimerPage';
{ path: '/timer/:activityId', element: <TimerPage /> },
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npm test -- src/hooks/useFocusTimer.test.ts`
Expected: `PASS` (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src
git commit -m "feat: 타이머 훅과 타이머 페이지 추가"
```

---

### Task 12: 꾸미 성장 로직 (지배 카테고리 + 단계 계산) + 조회 API

**Files:**
- Modify: `backend/src/services/growth.ts`
- Create: `backend/src/routes/growth.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/services/growth.test.ts`
- Test: `backend/src/routes/growth.test.ts`

**Interfaces:**
- Produces: `getStageForGauge(gaugeSeconds)`, `recomputeDominantCategory(userId)`(`services/growth.ts`), `GET /api/growth/me` — `{ currentGauge, stage, dominantCategory }` 응답.

- [ ] **Step 1: 실패하는 테스트 작성 (서비스 로직)**

`backend/src/services/growth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { getStageForGauge, recomputeDominantCategory, applySessionToGrowth } from './growth';

describe('getStageForGauge', () => {
  it('returns stage 0 for a fresh gauge', () => {
    expect(getStageForGauge(0)).toBe(0);
  });
  it('returns stage 1 at 1 hour', () => {
    expect(getStageForGauge(3600)).toBe(1);
  });
  it('returns stage 4 at 30+ hours', () => {
    expect(getStageForGauge(30 * 3600)).toBe(4);
  });
  it('returns the highest stage below the gauge', () => {
    expect(getStageForGauge(3 * 3600 - 1)).toBe(1);
  });
});

describe('recomputeDominantCategory', () => {
  it('picks the category with the most verified seconds', async () => {
    const user = await prisma.user.create({
      data: { email: 'dom@example.com', passwordHash: 'x', nickname: '테스터' },
    });
    const studyActivity = await prisma.activity.create({
      data: { userId: user.id, name: '공부', category: 'STUDY' },
    });
    const exerciseActivity = await prisma.activity.create({
      data: { userId: user.id, name: '운동', category: 'EXERCISE' },
    });
    await prisma.session.create({
      data: { userId: user.id, activityId: studyActivity.id, verifiedSeconds: 100, endedAt: new Date() },
    });
    await prisma.session.create({
      data: { userId: user.id, activityId: exerciseActivity.id, verifiedSeconds: 500, endedAt: new Date() },
    });

    const dominant = await recomputeDominantCategory(user.id);
    expect(dominant).toBe('EXERCISE');
  });

  it('returns null when there are no sessions', async () => {
    const user = await prisma.user.create({
      data: { email: 'nodom@example.com', passwordHash: 'x', nickname: '테스터2' },
    });
    const dominant = await recomputeDominantCategory(user.id);
    expect(dominant).toBeNull();
  });
});

describe('applySessionToGrowth', () => {
  it('creates a Growth row on first call', async () => {
    const user = await prisma.user.create({
      data: { email: 'growth1@example.com', passwordHash: 'x', nickname: '테스터3' },
    });
    await applySessionToGrowth(user.id, 42);
    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth?.currentGauge).toBe(42);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/services/growth.test.ts`
Expected: FAIL — `getStageForGauge`, `recomputeDominantCategory` 없음.

- [ ] **Step 3: 구현**

`backend/src/services/growth.ts`:
```ts
import { prisma } from '../db';
import { STAGE_THRESHOLDS } from '../constants';

export async function applySessionToGrowth(userId: string, verifiedSeconds: number) {
  const existing = await prisma.growth.findUnique({ where: { userId } });
  const newGauge = (existing?.currentGauge ?? 0) + verifiedSeconds;
  await prisma.growth.upsert({
    where: { userId },
    create: { userId, currentGauge: newGauge, lastActiveDate: new Date() },
    update: { currentGauge: newGauge, lastActiveDate: new Date() },
  });
}

export function getStageForGauge(gaugeSeconds: number): number {
  let stage = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (gaugeSeconds >= STAGE_THRESHOLDS[i]) stage = i;
  }
  return stage;
}

export async function recomputeDominantCategory(userId: string): Promise<string | null> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    include: { activity: { select: { category: true } } },
  });
  if (sessions.length === 0) return null;
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    const cat = s.activity.category;
    totals[cat] = (totals[cat] ?? 0) + s.verifiedSeconds;
  }
  let dominant = Object.keys(totals)[0];
  for (const cat of Object.keys(totals)) {
    if (totals[cat] > totals[dominant]) dominant = cat;
  }
  return dominant;
}
```

`backend/src/routes/growth.ts`:
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getStageForGauge, recomputeDominantCategory } from '../services/growth';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const growth = await prisma.growth.findUnique({ where: { userId: req.userId! } });
  const currentGauge = growth?.currentGauge ?? 0;
  const dominantCategory = await recomputeDominantCategory(req.userId!);
  res.json({
    currentGauge,
    stage: getStageForGauge(currentGauge),
    dominantCategory: dominantCategory ?? 'ETC',
  });
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import growthRouter from './routes/growth';
app.use('/api/growth', growthRouter);
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/services/growth.test.ts`
Expected: `PASS` (7 tests)

- [ ] **Step 5: growth 라우트 테스트 작성 및 실행**

`backend/src/routes/growth.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';

describe('GET /api/growth/me', () => {
  it('returns a default gauge of 0 for a new user', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'newgrowth@example.com',
      password: 'password123',
      nickname: '새유저',
    });
    const res = await request(app)
      .get('/api/growth/me')
      .set('Authorization', `Bearer ${signupRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.currentGauge).toBe(0);
    expect(res.body.stage).toBe(0);
  });
});
```

Run: `cd backend && npm test -- src/routes/growth.test.ts`
Expected: `PASS` (1 test)

- [ ] **Step 6: 커밋**

```bash
git add backend/src
git commit -m "feat: 꾸미 성장 로직(단계/지배카테고리)과 조회 API 추가"
```

---

### Task 13: 퇴화 배치 잡

**Files:**
- Create: `backend/src/services/decay.ts`
- Create: `backend/src/jobs/decayJob.ts`
- Modify: `backend/src/cron.ts`
- Test: `backend/src/services/decay.test.ts`
- Test: `backend/src/jobs/decayJob.test.ts`

**Interfaces:**
- Produces: `computeDecayedGauge(currentGauge, lastActiveDate, now)`(`services/decay.ts`), `runDecayJob()`(`jobs/decayJob.ts`).

- [ ] **Step 1: 실패하는 테스트 작성 (순수 함수)**

`backend/src/services/decay.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDecayedGauge } from './decay';

describe('computeDecayedGauge', () => {
  it('does not decay before day 3', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-02T12:00:00Z'); // 1일 경과
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(1000);
  });

  it('decays starting from day 3', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-04T00:00:00Z'); // 3일 경과
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(900);
  });

  it('compounds decay for multiple days', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-05T00:00:00Z'); // 4일 경과 -> 2일치 감소
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(810);
  });

  it('never goes below 0', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2027-01-01T00:00:00Z');
    expect(computeDecayedGauge(5, lastActive, now)).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/services/decay.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`backend/src/services/decay.ts`:
```ts
import { DECAY_START_DAYS, DECAY_RATE } from '../constants';

export function computeDecayedGauge(currentGauge: number, lastActiveDate: Date, now: Date): number {
  const daysSince = Math.floor((now.getTime() - lastActiveDate.getTime()) / 86_400_000);
  if (daysSince < DECAY_START_DAYS) return currentGauge;
  const decayDays = daysSince - (DECAY_START_DAYS - 1);
  let gauge = currentGauge;
  for (let i = 0; i < decayDays; i++) {
    gauge = Math.floor(gauge * (1 - DECAY_RATE));
  }
  return Math.max(gauge, 0);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/services/decay.test.ts`
Expected: `PASS` (4 tests)

- [ ] **Step 5: 배치 잡 실패하는 테스트 작성**

`backend/src/jobs/decayJob.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../db';
import { runDecayJob } from './decayJob';

describe('runDecayJob', () => {
  it('decays gauges for inactive users', async () => {
    const user = await prisma.user.create({
      data: { email: 'decayjob@example.com', passwordHash: 'x', nickname: '테스터' },
    });
    await prisma.growth.create({
      data: {
        userId: user.id,
        currentGauge: 1000,
        lastActiveDate: new Date(Date.now() - 5 * 86_400_000),
      },
    });

    await runDecayJob();

    const growth = await prisma.growth.findUnique({ where: { userId: user.id } });
    expect(growth!.currentGauge).toBeLessThan(1000);
  });
});
```

- [ ] **Step 6: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/jobs/decayJob.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 7: 구현**

`backend/src/jobs/decayJob.ts`:
```ts
import { prisma } from '../db';
import { computeDecayedGauge } from '../services/decay';

export async function runDecayJob() {
  const growths = await prisma.growth.findMany();
  const now = new Date();
  for (const g of growths) {
    const decayed = computeDecayedGauge(g.currentGauge, g.lastActiveDate, now);
    if (decayed !== g.currentGauge) {
      await prisma.growth.update({ where: { id: g.id }, data: { currentGauge: decayed } });
    }
  }
}
```

`backend/src/cron.ts` 수정:
```ts
import cron from 'node-cron';
import { closeStaleSessions } from './jobs/staleSessionJob';
import { runDecayJob } from './jobs/decayJob';

export function registerCronJobs() {
  cron.schedule('*/5 * * * *', closeStaleSessions);
  cron.schedule('0 0 * * *', runDecayJob);
}
```

- [ ] **Step 8: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/jobs/decayJob.test.ts`
Expected: `PASS` (1 test)

- [ ] **Step 9: 커밋**

```bash
git add backend/src
git commit -m "feat: 퇴화 배치 잡 추가"
```

---

### Task 14: 프론트엔드 홈 대시보드 (꾸미 + 게이지)

**Files:**
- Create: `frontend/src/api/growth.ts`
- Modify: `frontend/src/pages/HomePage.tsx`
- Test: `frontend/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`
- Produces: `getMyGrowth()`(`api/growth.ts`) — `{ currentGauge, stage, dominantCategory }` 반환.

- [ ] **Step 1: growth API 클라이언트**

`frontend/src/api/growth.ts`:
```ts
import { apiFetch } from './client';

export interface GrowthState {
  currentGauge: number;
  stage: number;
  dominantCategory: 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';
}

export async function getMyGrowth(): Promise<GrowthState> {
  const res = await apiFetch('/api/growth/me');
  return res.json();
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/pages/HomePage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current stage and category', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' }),
    }) as any;

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText(/1단계/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test -- src/pages/HomePage.test.tsx`
Expected: FAIL — 현재 `HomePage`는 정적 텍스트만 있음.

- [ ] **Step 4: 구현**

`frontend/src/pages/HomePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';

export default function HomePage() {
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMyGrowth().then(setGrowth);
  }, []);

  if (!growth) return <p>불러오는 중...</p>;

  return (
    <div>
      <p>{growth.dominantCategory} 꾸미</p>
      <p>{growth.stage}단계</p>
      <p>누적 게이지: {growth.currentGauge}초</p>
      <button onClick={() => navigate('/activities')}>타이머 시작</button>
    </div>
  );
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npm test -- src/pages/HomePage.test.tsx`
Expected: `PASS` (1 test)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src
git commit -m "feat: 홈 대시보드에 꾸미 상태 표시"
```

---

### Task 15: 히스토리 집계 API

**Files:**
- Create: `backend/src/routes/history.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/routes/history.test.ts`

**Interfaces:**
- Produces: `GET /api/history?range=daily|weekly` — `[{ date, category, verifiedSeconds }]` 배열 응답.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/history.test.ts`:
```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../app';
import { prisma } from '../db';

describe('GET /api/history', () => {
  it('aggregates verified seconds by day and category', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'history@example.com',
      password: 'password123',
      nickname: '히스토리테스터',
    });
    const token = signupRes.body.token;
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    const activity = await prisma.activity.create({
      data: { userId: decoded.userId, name: '공부', category: 'STUDY' },
    });
    const today = new Date();
    await prisma.session.create({
      data: {
        userId: decoded.userId,
        activityId: activity.id,
        verifiedSeconds: 600,
        startedAt: today,
        endedAt: today,
      },
    });

    const res = await request(app)
      .get('/api/history?range=daily')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0].category).toBe('STUDY');
    expect(res.body[0].verifiedSeconds).toBe(600);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && npm test -- src/routes/history.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`backend/src/routes/history.ts`:
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
  const since = new Date();
  since.setDate(since.getDate() - (range === 'weekly' ? 7 * 4 : 7));

  const sessions = await prisma.session.findMany({
    where: { userId: req.userId!, endedAt: { gte: since } },
    include: { activity: { select: { category: true } } },
  });

  const buckets: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.endedAt) continue;
    const dateKey = s.endedAt.toISOString().slice(0, 10);
    const key = `${dateKey}::${s.activity.category}`;
    buckets[key] = (buckets[key] ?? 0) + s.verifiedSeconds;
  }

  const result = Object.entries(buckets).map(([key, verifiedSeconds]) => {
    const [date, category] = key.split('::');
    return { date, category, verifiedSeconds };
  });

  res.json(result);
});

export default router;
```

`backend/src/app.ts`에 마운트:
```ts
import historyRouter from './routes/history';
app.use('/api/history', historyRouter);
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd backend && npm test -- src/routes/history.test.ts`
Expected: `PASS` (1 test)

- [ ] **Step 5: 커밋**

```bash
git add backend/src
git commit -m "feat: 히스토리 집계 API 추가"
```

---

### Task 16: 프론트엔드 히스토리 페이지

**Files:**
- Create: `frontend/src/api/history.ts`
- Create: `frontend/src/pages/HistoryPage.tsx`
- Modify: `frontend/src/router.tsx`
- Test: `frontend/src/pages/HistoryPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`
- Produces: `getHistory(range)`(`api/history.ts`).

- [ ] **Step 1: history API 클라이언트**

`frontend/src/api/history.ts`:
```ts
import { apiFetch } from './client';

export interface HistoryEntry {
  date: string;
  category: string;
  verifiedSeconds: number;
}

export async function getHistory(range: 'daily' | 'weekly'): Promise<HistoryEntry[]> {
  const res = await apiFetch(`/api/history?range=${range}`);
  return res.json();
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/pages/HistoryPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HistoryPage from './HistoryPage';

describe('HistoryPage', () => {
  it('renders history entries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-07-13', category: 'STUDY', verifiedSeconds: 600 }],
    }) as any;

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText(/600/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `cd frontend && npm test -- src/pages/HistoryPage.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

`frontend/src/pages/HistoryPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [range, setRange] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    getHistory(range).then(setEntries);
  }, [range]);

  return (
    <div>
      <select value={range} onChange={(e) => setRange(e.target.value as 'daily' | 'weekly')}>
        <option value="daily">일간</option>
        <option value="weekly">주간</option>
      </select>
      <ul>
        {entries.map((e, i) => (
          <li key={i}>
            {e.date} - {e.category}: {e.verifiedSeconds}초
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`frontend/src/router.tsx`에 라우트 추가:
```tsx
import HistoryPage from './pages/HistoryPage';
{ path: '/history', element: <HistoryPage /> },
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npm test -- src/pages/HistoryPage.test.tsx`
Expected: `PASS` (1 test)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src
git commit -m "feat: 히스토리 페이지 추가"
```

---

### Task 17: PWA 설치 지원

**Files:**
- Modify: `frontend/package.json` (vite-plugin-pwa 추가)
- Modify: `frontend/vite.config.ts`

**Interfaces:**
- Produces: 빌드 시 `dist/manifest.webmanifest`, `dist/sw.js` 생성.

- [ ] **Step 1: 의존성 설치**

Run: `cd frontend && npm install -D vite-plugin-pwa`
Expected: `devDependencies`에 추가됨.

- [ ] **Step 2: 설정 추가**

`frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '그로우미',
        short_name: '그로우미',
        description: '타이머로 몰입 인증하고 꾸미를 키우는 자기계발 서비스',
        theme_color: '#22c55e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

192x192, 512x512 아이콘 PNG 파일을 `frontend/public/icon-192.png`, `frontend/public/icon-512.png`에 직접 준비해서 넣는다 (임시로 단색 사각형이라도 넣어야 빌드가 매니페스트를 정상 생성함).

- [ ] **Step 3: 빌드로 검증**

Run: `cd frontend && npm run build`
Expected: `dist/manifest.webmanifest`와 `dist/sw.js`가 생성됨. `ls dist`로 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/public
git commit -m "feat: PWA 설치 지원 추가"
```

---

## 확장 포인트 (이 계획에서 구현하지 않음)

- 친구/소셜 기능, 랭킹
- 사진 등 타이머 외 인증 방식
- 캐릭터 커스터마이징(옷 꾸미기), 3D 시각화
- Electron 네이티브 데스크톱 앱
- 알림/푸시, 통계 고도화
- 수익화(구독/결제)
- 계정(이메일-소셜) 연결/병합
- 카테고리별 집계 캐시 테이블(성능 필요 시)
- 설정 페이지(프로필 수정, 로그아웃 버튼) — 로그아웃은 `useAuth().logout()`으로 이미 가능하니 버튼 하나만 있으면 되는 수준이라, 실제 구현 시점에 5분짜리 작업으로 추가해도 무방
