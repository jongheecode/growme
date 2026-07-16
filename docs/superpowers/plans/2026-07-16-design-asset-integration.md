# 디자인 자산 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `html/` 폴더에 제공된 5개 목업(로그인 애니메이션, 홈 대시보드, 히스토리, 프로필, 꾸미 인터랙티브 놀이터)을 실제 React 컴포넌트로 이식한다.

**Architecture:** 목업의 순수 SVG/DOM 생성 로직을 React가 반환하는 JSX 함수(`renderKkumi`)로 재작성하고, 걷기 애니메이션은 `useEffect` + `requestAnimationFrame` 기반 컴포넌트(`KkumiHerd`)로 분리한다. 각 페이지는 목업의 레이아웃/색상/좌표를 그대로 쓰되 더미 데이터를 실제 API 응답으로 교체한다.

**Tech Stack:** React 18 + TypeScript + Tailwind v4 + Vitest(프론트), Express + Prisma(백엔드, `history` 라우트에 range 옵션 하나 추가).

## Global Constraints

- 목업의 색상 값·SVG 좌표·애니메이션 타이밍은 그대로 유지한다(디자인 판단은 끝났음, 이식만 한다).
- 목업의 더미/랜덤 데이터(홈 히트맵 `Math.random()`, 하드코딩된 스탯 등)는 반드시 실제 API 데이터로 교체한다 — 조작된 데이터를 화면에 표시하지 않는다.
- 실데이터가 없는 값(홈의 뱃지 5칸, 진행바 정확한 %)은 정직하게 빈 상태로 표시한다(스펙 문서 참고).
- 이 플랜의 워크트리는 `2026-07-16-v1.5-desktop-shell-profile.md`가 master에 머지된 뒤에 브랜치를 딴다(`ProfilePage.tsx`가 이미 존재해야 Task 9에서 교체할 수 있음).
- 완료 후 `html/` 폴더를 삭제한다(Task 10).

---

## 파일 구조

**신규 생성**
- `frontend/src/components/kkumi/palette.ts`
- `frontend/src/components/kkumi/renderKkumi.tsx`
- `frontend/src/components/kkumi/renderKkumi.test.tsx`
- `frontend/src/components/kkumi/KkumiHerd.tsx`
- `frontend/src/components/kkumi/KkumiHerd.test.tsx`

**수정**
- `frontend/package.json` (`@tabler/icons-react` 추가)
- `frontend/src/index.css`
- `frontend/src/components/KkumiCharacter.tsx`
- `frontend/src/pages/LoginPage.tsx` (+ 필요 시 `LoginPage.test.tsx`)
- `frontend/src/pages/HomePage.tsx` + `HomePage.test.tsx`
- `frontend/src/api/history.ts`
- `frontend/src/pages/HistoryPage.tsx` + `HistoryPage.test.tsx`
- `frontend/src/pages/ProfilePage.tsx` + `ProfilePage.test.tsx`
- `backend/src/routes/history.ts` + `history.test.ts`

**삭제 (Task 10)**
- `html/` 전체

---

### Task 1: 디자인 토큰 + Tabler Icons 의존성

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/package.json`

- [ ] **Step 1: `index.css`의 `@theme`에 토큰 추가**

`--color-honey-dark: #c98a00;` 다음 줄에 추가:
```css
  --color-grass-light: #c8e6ab;
  --color-grass: #96cc7c;
  --color-grass-dark: #4f8f3d;
  --color-card-border: #f0e2cf;
  --color-card-bg: #fffdf9;
  --color-tan: #a08a76;
  --color-tan-dark: #8a6a4a;
  --color-wood-light: #f0c48c;
  --color-wood: #c98f52;
  --color-wood-dark: #8d5f31;
```

- [ ] **Step 2: `@tabler/icons-react` 설치**

Run: `cd frontend && npm install @tabler/icons-react`
Expected: `package.json`의 `dependencies`에 추가됨

- [ ] **Step 3: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/package.json frontend/package-lock.json
git commit -m "feat: 목업 색상 토큰 추가, Tabler Icons 의존성 설치"
```

---

### Task 2: 꾸미 팔레트 + `renderKkumi` 순수 함수

**Files:**
- Create: `frontend/src/components/kkumi/palette.ts`
- Create: `frontend/src/components/kkumi/renderKkumi.tsx`
- Create: `frontend/src/components/kkumi/renderKkumi.test.tsx`

**Interfaces:**
- Produces: `Category` 타입(`'STUDY'|'EXERCISE'|'READING'|'ETC'`), `KKUMI_PALETTE: Record<Category, CategoryTone>`. `renderKkumi(stage: number, category: Category, r: number, keyPrefix: string): JSX.Element` — Task 3(KkumiCharacter), Task 4(KkumiHerd)에서 사용. `keyPrefix`는 같은 화면에 여러 마리를 동시에 그릴 때 SVG gradient id 충돌을 막기 위한 접두사(호출자가 고유값을 넘겨야 함).

- [ ] **Step 1: `palette.ts` 구현** (`kkumi_roaming_stages_categories_interactive.html`의 `C` 객체를 그대로 이식, study→STUDY/fit→EXERCISE/read→READING/etc→ETC로 키 매핑)

`frontend/src/components/kkumi/palette.ts`:
```ts
export type Category = 'STUDY' | 'EXERCISE' | 'READING' | 'ETC';

export interface CategoryTone {
  name: string;
  lo: string;
  mid: string;
  hi: string;
  ear: string;
  bel: string;
  egg: string;
  shell: string;
}

export const KKUMI_PALETTE: Record<Category, CategoryTone> = {
  STUDY: {
    name: '공부',
    lo: '#d6f5ee',
    mid: '#8FD4C8',
    hi: '#3f9c8c',
    ear: '#5cb8a8',
    bel: '#2f8878',
    egg: '#cfeee7',
    shell: '#7bc3b6',
  },
  EXERCISE: {
    name: '운동',
    lo: '#ffd3de',
    mid: '#ff9db5',
    hi: '#e85d82',
    ear: '#ffb3c6',
    bel: '#c94467',
    egg: '#ffdfe7',
    shell: '#f08aa6',
  },
  READING: {
    name: '독서',
    lo: '#ffeeb8',
    mid: '#ffd166',
    hi: '#c98a00',
    ear: '#f0b93f',
    bel: '#a86f00',
    egg: '#fff0c9',
    shell: '#e8bc4e',
  },
  ETC: {
    name: '기타',
    lo: '#e2dcf7',
    mid: '#a89ae0',
    hi: '#5f52a8',
    ear: '#8f7fd4',
    bel: '#4a3f8c',
    egg: '#e8e3f8',
    shell: '#9a8ad8',
  },
};
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/components/kkumi/renderKkumi.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderKkumi } from './renderKkumi';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="-60 -60 120 120">
      <g>{children}</g>
    </svg>
  );
}

describe('renderKkumi', () => {
  it.each([0, 1, 2, 3])('renders stage %i without crashing', (stage) => {
    const { container } = render(
      <Wrapper>{renderKkumi(stage, 'STUDY', 30, `test-${stage}`)}</Wrapper>
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('uses a different gradient color for each category at the same stage', () => {
    const { container: studyContainer } = render(
      <Wrapper>{renderKkumi(2, 'STUDY', 30, 'study')}</Wrapper>
    );
    const { container: fitContainer } = render(
      <Wrapper>{renderKkumi(2, 'EXERCISE', 30, 'fit')}</Wrapper>
    );
    const studyStop = studyContainer.querySelector('stop[stop-color="#3f9c8c"]');
    const fitStop = fitContainer.querySelector('stop[stop-color="#e85d82"]');
    expect(studyStop).toBeInTheDocument();
    expect(fitStop).toBeInTheDocument();
  });

  it('adds a crown only at stage 3', () => {
    const { container: stage2 } = render(<Wrapper>{renderKkumi(2, 'READING', 30, 's2')}</Wrapper>);
    const { container: stage3 } = render(<Wrapper>{renderKkumi(3, 'READING', 30, 's3')}</Wrapper>);
    expect(stage2.querySelectorAll('circle[fill="#ffd166"]').length).toBe(0);
    expect(stage3.querySelectorAll('circle[fill="#ffd166"]').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/components/kkumi/renderKkumi.test.tsx`
Expected: FAIL — `Failed to resolve import "./renderKkumi"`

- [ ] **Step 4: `renderKkumi.tsx` 구현** (`kkumi(stage,cat,r)`/`body(g,c,r)`/`eyes(g,c,r)` 함수를 JSX로 이식)

`frontend/src/components/kkumi/renderKkumi.tsx`:
```tsx
import { Category, KKUMI_PALETTE } from './palette';

function eyes(r: number, keyPrefix: string) {
  const lx = -r * 0.34;
  const rx = r * 0.34;
  const ey = -r * 0.1;
  const er = Math.max(1.8, r * 0.16);
  return (
    <g key={`${keyPrefix}-eyes`}>
      {[lx, rx].map((x, i) => (
        <g key={`${keyPrefix}-eye-${i}`} className="kk-eye" style={{ transformOrigin: `${x}px ${ey}px` }}>
          <circle cx={x} cy={ey} r={er} fill="#4a4045" />
          <circle cx={x + er * 0.36} cy={ey - er * 0.36} r={er * 0.32} fill="#fff" />
        </g>
      ))}
      <path
        d={`M${-r * 0.22} ${r * 0.34} q${r * 0.22} ${r * 0.18} ${r * 0.44} 0`}
        stroke="#4a4045"
        strokeWidth={Math.max(1.2, r * 0.075)}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={-r * 0.78} cy={r * 0.2} r={er} fill="#ff7a9c" opacity={0.4} />
      <circle cx={r * 0.78} cy={r * 0.2} r={er} fill="#ff7a9c" opacity={0.4} />
    </g>
  );
}

function body(tone: CategoryToneLike, r: number, keyPrefix: string) {
  const gradId = `${keyPrefix}-body-grad`;
  return (
    <g key={`${keyPrefix}-body`}>
      <defs>
        <radialGradient id={gradId} cx="0.34" cy="0.28" r="0.85">
          <stop offset="0" stopColor={tone.lo} />
          <stop offset="0.45" stopColor={tone.mid} />
          <stop offset="1" stopColor={tone.hi} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={r * 0.16} rx={r * 0.86} ry={r * 0.3} fill={tone.bel} opacity={0.16} />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.95} fill={`url(#${gradId})`} />
      <ellipse cx={0} cy={r * 0.4} rx={r * 0.68} ry={r * 0.3} fill={tone.bel} opacity={0.16} />
      <ellipse cx={-r * 0.38} cy={-r * 0.48} rx={r * 0.3} ry={r * 0.2} fill="#fff" opacity={0.45} />
    </g>
  );
}

type CategoryToneLike = (typeof KKUMI_PALETTE)[Category];

export function renderKkumi(stage: number, category: Category, r: number, keyPrefix: string) {
  const tone = KKUMI_PALETTE[category];

  if (stage === 0) {
    const gradId = `${keyPrefix}-egg-grad`;
    return (
      <g key={`${keyPrefix}-egg`}>
        <defs>
          <radialGradient id={gradId} cx="0.34" cy="0.28" r="0.85">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="0.5" stopColor={tone.egg} />
            <stop offset="1" stopColor={tone.shell} />
          </radialGradient>
        </defs>
        <ellipse cx={0} cy={0} rx={r * 0.8} ry={r * 1.05} fill={`url(#${gradId})`} />
        <ellipse cx={-r * 0.28} cy={-r * 0.38} rx={r * 0.22} ry={r * 0.3} fill="#fff" opacity={0.5} />
        <path
          d={`M${-r * 0.56} ${r * 0.1} q${r * 0.19} ${-r * 0.11} ${r * 0.38} 0 q${r * 0.19} ${r * 0.11} ${r * 0.38} 0`}
          stroke={tone.shell}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (stage === 1) {
    return (
      <g key={`${keyPrefix}-hatch`}>
        <path
          d={`M${-r * 0.8} ${r * 0.1} L${-r * 0.8} ${r * 0.5} Q${-r * 0.8} ${r * 0.95} 0 ${r * 0.95} Q${r * 0.8} ${r * 0.95} ${r * 0.8} ${r * 0.5} L${r * 0.8} ${r * 0.1} Z`}
          fill={tone.egg}
        />
        <path
          d={`M${-r * 0.8} ${r * 0.1} L${-r * 0.6} ${-r * 0.06} L${-r * 0.4} ${r * 0.1} L${-r * 0.2} ${-r * 0.1} L0 ${r * 0.1} L${r * 0.2} ${-r * 0.1} L${r * 0.4} ${r * 0.1} L${r * 0.6} ${-r * 0.06} L${r * 0.8} ${r * 0.1}`}
          stroke={tone.shell}
          strokeWidth={1.8}
          fill="none"
          strokeLinejoin="round"
        />
        <g transform={`translate(0 ${-r * 0.2})`}>
          {body(tone, r * 0.56, `${keyPrefix}-h`)}
          {eyes(r * 0.56, `${keyPrefix}-h`)}
        </g>
      </g>
    );
  }

  const w = stage === 2 ? 0.34 : 0.4;
  const s = stage === 2 ? r * 0.3 : r * 0.36;

  return (
    <g key={`${keyPrefix}-grown`}>
      {body(tone, r, keyPrefix)}
      <path
        d={`M${-r * 0.56} ${-r * 0.72} q${-r * w} ${-r * 0.5} ${r * 0.3} ${-r * 0.16}`}
        stroke={tone.ear}
        strokeWidth={s}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${r * 0.56} ${-r * 0.72} q${r * w} ${-r * 0.5} ${-r * 0.3} ${-r * 0.16}`}
        stroke={tone.ear}
        strokeWidth={s}
        fill="none"
        strokeLinecap="round"
      />
      {stage >= 3 && (
        <g key={`${keyPrefix}-crown`}>
          <circle cx={-r * 0.54} cy={-r * 1.02} r={r * 0.11} fill="#ffd166" />
          <circle cx={r * 0.54} cy={-r * 1.02} r={r * 0.11} fill="#ffd166" />
          <path d={`M${-r * 0.16} ${-r * 1.22} L0 ${-r * 1.6} L${r * 0.16} ${-r * 1.22} Z`} fill="#ffd166" />
          <circle cx={0} cy={-r * 1.66} r={r * 0.14} fill="#ffd166" />
        </g>
      )}
      {eyes(r, keyPrefix)}
    </g>
  );
}
```

- [ ] **Step 5: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/components/kkumi/renderKkumi.test.tsx`
Expected: PASS (6 tests: stage 0-3 각각 + 카테고리별 색상 + crown)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/kkumi/palette.ts frontend/src/components/kkumi/renderKkumi.tsx frontend/src/components/kkumi/renderKkumi.test.tsx
git commit -m "feat: 꾸미 카테고리 팔레트와 SVG 렌더러(renderKkumi) 추가"
```

---

### Task 3: `KkumiCharacter` 재작성 (기존 API 유지)

**Files:**
- Modify: `frontend/src/components/KkumiCharacter.tsx`

**Interfaces:**
- Consumes: `renderKkumi`, `Category`, `KKUMI_PALETTE`(Task 2).
- Produces: `KkumiCharacter({stage, category, radius?})` — 기존 시그니처(`{stage, category}`) 그대로 유지해 HomePage/LoginPage/TimerPage 등 기존 호출부가 안 깨짐. `CATEGORY_TINT` export도 그대로 유지(ActivitySelectPage가 여전히 씀 — 이번 플랜에서 안 건드리는 페이지).

- [ ] **Step 1: 기존 테스트 회귀 확인용 베이스라인**

Run: `cd frontend && npx vitest run`
Expected: 전부 PASS (변경 전)

- [ ] **Step 2: `KkumiCharacter.tsx` 전체 교체**

`frontend/src/components/KkumiCharacter.tsx`:
```tsx
import { renderKkumi } from './kkumi/renderKkumi';
import type { Category } from './kkumi/palette';

export type { Category };

interface Tint {
  light: string;
  dark: string;
}

// 기존 ActivitySelectPage가 아이콘 배지 색으로 여전히 쓰는 매핑 — renderKkumi의
// 7톤 팔레트(kkumi/palette.ts)와는 별개로 유지한다(용도가 다름: 이건 아이콘 배지용,
// 저건 캐릭터 몸통 그라디언트용).
export const CATEGORY_TINT: Record<Category, Tint> = {
  EXERCISE: { light: '#FFAB91', dark: '#FF8A65' },
  STUDY: { light: '#90CAF9', dark: '#64B5F6' },
  READING: { light: '#CE93D8', dark: '#BA68C8' },
  ETC: { light: '#8FD4C8', dark: '#6BC5B8' },
};

export function KkumiCharacter({
  stage,
  category,
  radius = 40,
}: {
  stage: number;
  category: Category;
  radius?: number;
}) {
  const visualStage = Math.min(stage, 3);
  return (
    <svg viewBox={`${-radius * 1.3} ${-radius * 1.3} ${radius * 2.6} ${radius * 2.6}`} className="w-full h-full">
      <ellipse cx={0} cy={radius * 0.95} rx={radius * 0.7} ry={radius * 0.18} fill="#3c5c2e" opacity={0.15} />
      {renderKkumi(visualStage, category, radius, 'kc')}
    </svg>
  );
}
```

- [ ] **Step 3: 전체 테스트 실행해 회귀 확인**

Run: `cd frontend && npx vitest run`
Expected: 전부 PASS — `KkumiCharacter`를 쓰는 HomePage/LoginPage/TimerPage 테스트가 여전히 통과해야 함(이 컴포넌트는 `stage`/`category` prop을 그대로 받으므로 호출부 변경 불필요)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/KkumiCharacter.tsx
git commit -m "refactor: KkumiCharacter가 renderKkumi를 쓰도록 재작성, 기존 API·CATEGORY_TINT 유지"
```

---

### Task 4: `KkumiHerd` — 걷기 애니메이션 + 클릭 인터랙션

**Files:**
- Create: `frontend/src/components/kkumi/KkumiHerd.tsx`
- Create: `frontend/src/components/kkumi/KkumiHerd.test.tsx`

**Interfaces:**
- Consumes: `renderKkumi`, `Category`(Task 2).
- Produces: `KkumiHerd({ members, width, height }: { members: {x: number; y: number; r: number; stage: number; category: Category}[]; width: number; height: number })` — LoginPage(Task 6)와 HomePage(Task 7)에서 사용.

`kkumi_roaming_stages_categories_interactive.html`의 `tick()`(requestAnimationFrame 루프)과 클릭 핸들러를 이식한다. 원본은 전역 `mates` 배열을 직접 변형(mutate)하지만, React 버전은 `useRef`로 애니메이션 상태를 들고 매 프레임 DOM(`<g>` 엘리먼트의 `transform` 속성)을 직접 갱신한다 — React state로 매 프레임 리렌더하면 성능이 나쁘므로 `ref.current.setAttribute`로 직접 조작하는 원본 방식을 그대로 따른다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/kkumi/KkumiHerd.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KkumiHerd } from './KkumiHerd';

describe('KkumiHerd', () => {
  it('renders one group per member', () => {
    const members = [
      { x: 100, y: 150, r: 20, stage: 2, category: 'STUDY' as const },
      { x: 300, y: 160, r: 16, stage: 1, category: 'EXERCISE' as const },
    ];
    const { container } = render(<KkumiHerd members={members} width={680} height={260} />);
    // 각 멤버는 그림자 <ellipse> + 캐릭터를 감싸는 <g> 하나씩 -> data-testid로 셀 수 있게 렌더
    expect(container.querySelectorAll('[data-testid="kkumi-herd-member"]').length).toBe(2);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/components/kkumi/KkumiHerd.test.tsx`
Expected: FAIL — `Failed to resolve import "./KkumiHerd"`

- [ ] **Step 3: `KkumiHerd.tsx` 구현**

`frontend/src/components/kkumi/KkumiHerd.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { renderKkumi } from './renderKkumi';
import type { Category } from './palette';

export interface KkumiHerdMember {
  x: number;
  y: number;
  r: number;
  stage: number;
  category: Category;
}

interface MotionState {
  shadowEl: SVGEllipseElement | null;
  bodyEl: SVGGElement | null;
  x: number;
  y: number;
  r: number;
  hx: number;
  vx: number;
  t: number;
  sp: number;
  pk: number;
  flee: number;
}

export function KkumiHerd({
  members,
  width,
  height,
}: {
  members: KkumiHerdMember[];
  width: number;
  height: number;
}) {
  const groupRef = useRef<SVGGElement>(null);
  const motionRef = useRef<MotionState[]>([]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    motionRef.current = members.map((m, i) => ({
      shadowEl: group.querySelector<SVGEllipseElement>(`[data-shadow="${i}"]`),
      bodyEl: group.querySelector<SVGGElement>(`[data-body="${i}"]`),
      x: m.x,
      y: m.y,
      r: m.r,
      hx: m.x,
      vx: (Math.random() < 0.5 ? -1 : 1) * (0.24 + Math.random() * 0.3),
      t: Math.random() * 9,
      sp: 0.055 + Math.random() * 0.035,
      pk: 9 + Math.random() * 7,
      flee: 0,
    }));

    let rafId: number;
    let last: number | null = null;

    function tick(ts: number) {
      if (last === null) last = ts;
      const dt = Math.min(34, ts - last);
      last = ts;

      for (const m of motionRef.current) {
        if (!m.shadowEl || !m.bodyEl) continue;
        m.t += dt * m.sp * 0.06;
        const sp = m.flee > 0 ? m.vx * 3.4 : m.vx;
        m.hx += sp * dt * 0.055;
        if (m.hx < 34) {
          m.hx = 34;
          m.vx = Math.abs(m.vx);
        }
        if (m.hx > width - 34) {
          m.hx = width - 34;
          m.vx = -Math.abs(m.vx);
        }
        if (m.flee > 0) m.flee -= dt;
        const ph = Math.abs(Math.sin(m.t));
        const lift = ph * (m.flee > 0 ? m.pk * 1.7 : m.pk);
        const sq = 1 + Math.cos(m.t * 2) * 0.07;
        const face = m.vx < 0 ? -1 : 1;
        m.bodyEl.setAttribute(
          'transform',
          `translate(${m.hx.toFixed(1)} ${(m.y - lift).toFixed(1)}) scale(${face} ${sq.toFixed(3)})`
        );
        m.shadowEl.setAttribute('cx', m.hx.toFixed(1));
        m.shadowEl.setAttribute('rx', (m.r * 0.9 * (1 - ph * 0.28)).toFixed(1));
        m.shadowEl.setAttribute('opacity', (1 - ph * 0.35).toFixed(2));
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [members, width]);

  function handleClick(e: React.MouseEvent<SVGGElement>) {
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const cx = ((e.clientX - box.left) / box.width) * width;
    for (const m of motionRef.current) {
      m.flee = 760;
      m.vx = (m.hx < cx ? -1 : 1) * Math.abs(m.vx);
    }
  }

  return (
    <g ref={groupRef} onClick={handleClick} style={{ cursor: 'pointer' }}>
      {members.map((m, i) => (
        <g key={i} data-testid="kkumi-herd-member">
          <ellipse
            data-shadow={i}
            cx={m.x}
            cy={m.y + m.r * 0.95 + 4}
            rx={m.r * 0.9}
            ry={m.r * 0.28}
            fill="#3c5c2e"
            opacity={0.2}
          />
          <g data-body={i} transform={`translate(${m.x} ${m.y})`}>
            {renderKkumi(Math.min(m.stage, 3), m.category, m.r, `herd-${i}`)}
          </g>
        </g>
      ))}
    </g>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/components/kkumi/KkumiHerd.test.tsx`
Expected: PASS (1 test) — jsdom 환경에서 `requestAnimationFrame`은 폴리필되어 있어 `useEffect`가 에러 없이 실행됨(실제 프레임 갱신 여부는 테스트하지 않음)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/kkumi/KkumiHerd.tsx frontend/src/components/kkumi/KkumiHerd.test.tsx
git commit -m "feat: 꾸미 무리 걷기 애니메이션/클릭 도망 컴포넌트(KkumiHerd) 추가"
```

---

### Task 5: 백엔드 — 히스토리 API `range=6months`

**Files:**
- Modify: `backend/src/routes/history.ts`
- Modify: `backend/src/routes/history.test.ts`
- Modify: `frontend/src/api/history.ts`

**Interfaces:**
- Produces: `GET /api/history?range=6months` — 최근 약 6개월(182일) 범위. 프론트 `getHistory(range: 'daily' | 'weekly' | '6months')`.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/routes/history.test.ts` 파일 끝에 추가(파일에 이미 있는 `describe('GET /api/history', ...)` 블록 뒤):
```ts
describe('GET /api/history?range=6months', () => {
  it('includes sessions from more than 4 weeks ago but within 6 months', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'sixmonths@example.com',
      password: 'password123',
      nickname: '반년테스터',
    });
    const token = signupRes.body.token;
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    const activity = await prisma.activity.create({
      data: { userId: decoded.userId, name: '독서', category: 'READING' },
    });
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    await prisma.session.create({
      data: {
        userId: decoded.userId,
        activityId: activity.id,
        verifiedSeconds: 900,
        startedAt: twoMonthsAgo,
        endedAt: twoMonthsAgo,
      },
    });

    const res = await request(app)
      .get('/api/history?range=6months')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((e: any) => e.verifiedSeconds === 900)).toBe(true);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd backend && npm test -- history.test.ts`
Expected: FAIL — 현재 `range`가 `'weekly'`가 아니면 전부 `'daily'`(7일)로 처리되어 2개월 전 세션이 안 잡힘

- [ ] **Step 3: `history.ts` 수정**

`backend/src/routes/history.ts`의 다음:
```ts
    const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
    const since = new Date();
    since.setDate(since.getDate() - (range === 'weekly' ? 7 * 4 : 7));
```
을 다음으로 교체:
```ts
    const range = req.query.range === 'weekly' ? 'weekly' : req.query.range === '6months' ? '6months' : 'daily';
    const since = new Date();
    if (range === '6months') {
      since.setMonth(since.getMonth() - 6);
    } else {
      since.setDate(since.getDate() - (range === 'weekly' ? 7 * 4 : 7));
    }
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd backend && npm test -- history.test.ts`
Expected: PASS

- [ ] **Step 5: 프론트 `api/history.ts` 타입 확장**

`frontend/src/api/history.ts`의:
```ts
export async function getHistory(range: 'daily' | 'weekly'): Promise<HistoryEntry[]> {
```
을:
```ts
export async function getHistory(range: 'daily' | 'weekly' | '6months'): Promise<HistoryEntry[]> {
```

- [ ] **Step 6: 백엔드 전체 테스트 + 프론트 타입체크**

Run: `cd backend && npm test && cd ../frontend && npx tsc --noEmit`
Expected: 전부 PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/history.ts backend/src/routes/history.test.ts frontend/src/api/history.ts
git commit -m "feat: 히스토리 API에 6개월 범위(range=6months) 추가"
```

---

### Task 6: LoginPage — 목업 배경 이식 + 실제 폼 오버레이

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: 없음(자체 SVG, 기존 `login`/`signup` API·`useAuth` 그대로 사용).

목업(`growme_login_animated_css_keyframes.html`)의 SVG(하늘/구름/언덕 4겹/풀잎/꽃잎/나무 팻말/꾸미 5마리)를 그대로 이식하되, 팻말에 SVG로 그려진 이메일/비밀번호 입력창·버튼(`<rect>`+`<text>`)은 제거하고 그 자리에 실제 `<input>`/`<button>`을 절대좌표로 겹친다. 좌표는 원본 `viewBox="0 0 680 430"` 기준 픽셀을 퍼센트로 환산(예: `x=196,y=194,w=288,h=38` → `left:28.8%; top:45.1%; width:42.4%; height:8.8%`).

- [ ] **Step 1: 기존 테스트가 통과하는지 먼저 확인 (베이스라인)**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: PASS

- [ ] **Step 2: `LoginPage.tsx` 전체 교체**

`frontend/src/pages/LoginPage.tsx`:
```tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const KEYFRAMES = `
@keyframes gm-hop{0%,100%{transform:translateY(0) scaleY(1)}12%{transform:translateY(0) scaleY(.86)}30%{transform:translateY(-16px) scaleY(1.08)}50%{transform:translateY(-20px) scaleY(1)}70%{transform:translateY(0) scaleY(.9)}82%{transform:translateY(0) scaleY(1.04)}}
@keyframes gm-hop-s{0%,100%{transform:translateY(0) scaleY(1)}14%{transform:translateY(0) scaleY(.88)}32%{transform:translateY(-11px) scaleY(1.06)}52%{transform:translateY(-13px) scaleY(1)}72%{transform:translateY(0) scaleY(.92)}84%{transform:translateY(0) scaleY(1.03)}}
@keyframes gm-sway{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
@keyframes gm-grass{0%,100%{transform:skewX(0deg)}50%{transform:skewX(9deg)}}
@keyframes gm-cloud{0%{transform:translateX(0)}100%{transform:translateX(58px)}}
@keyframes gm-petal{0%{transform:translate(0,0) rotate(0);opacity:0}8%{opacity:.85}92%{opacity:.85}100%{transform:translate(190px,150px) rotate(320deg);opacity:0}}
@keyframes gm-squash{0%,100%{transform:scale(1,1)}50%{transform:scale(1.05,.95)}}
#gm-k1{animation:gm-hop-s 2.6s cubic-bezier(.3,.6,.4,1) infinite;transform-origin:140px 197px}
#gm-k2{animation:gm-hop 3.4s cubic-bezier(.3,.6,.4,1) .7s infinite;transform-origin:512px 239px}
#gm-k3{animation:gm-hop 3s cubic-bezier(.3,.6,.4,1) 1.4s infinite;transform-origin:626px 324px}
#gm-k4{animation:gm-hop 3.8s cubic-bezier(.3,.6,.4,1) .3s infinite;transform-origin:66px 355px}
#gm-k5{animation:gm-squash 2.2s ease-in-out infinite;transform-origin:452px 127px}
#gm-sign{animation:gm-sway 4.6s ease-in-out infinite;transform-origin:340px 122px}
#gm-grass{animation:gm-grass 3.6s ease-in-out infinite;transform-origin:340px 430px}
#gm-cl1{animation:gm-cloud 46s linear infinite}
#gm-cl2{animation:gm-cloud 62s linear infinite}
.gm-p{animation:gm-petal 9s linear infinite}
.gm-p2{animation-duration:11s;animation-delay:2.5s}
.gm-p3{animation-duration:8s;animation-delay:5s}
.gm-p4{animation-duration:12s;animation-delay:1.2s}
@media (prefers-reduced-motion:reduce){#gm-k1,#gm-k2,#gm-k3,#gm-k4,#gm-k5,#gm-sign,#gm-grass,#gm-cl1,#gm-cl2,.gm-p{animation:none}}
`;

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
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <style>{KEYFRAMES}</style>
      <div className="relative w-full max-w-3xl rounded-xl overflow-hidden" style={{ lineHeight: 0 }}>
        <svg viewBox="0 0 680 430" className="block w-full h-auto" role="img" xmlns="http://www.w3.org/2000/svg">
          <title>그로우미 로그인 화면 애니메이션</title>
          <desc>꾸미들이 통통 뛰고 나무 팻말이 좌우로 흔들리며 풀과 꽃잎이 바람에 날리는 로그인 화면</desc>
          <defs>
            <linearGradient id="a-sky" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#fff8f0" />
              <stop offset="0.55" stopColor="#ffefd6" />
              <stop offset="1" stopColor="#ffe0b8" />
            </linearGradient>
            <linearGradient id="a-h1" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stopColor="#e2f0cf" />
              <stop offset="1" stopColor="#bcdca4" />
            </linearGradient>
            <linearGradient id="a-h2" x1="0.1" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#c6e5a8" />
              <stop offset="1" stopColor="#96cc7c" />
            </linearGradient>
            <linearGradient id="a-h3" x1="0.1" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#a5d886" />
              <stop offset="1" stopColor="#6fb257" />
            </linearGradient>
            <linearGradient id="a-h4" x1="0.1" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor="#7cbd62" />
              <stop offset="1" stopColor="#4f8f3d" />
            </linearGradient>
            <linearGradient id="a-wf" x1="0.15" y1="0" x2="0.7" y2="1">
              <stop offset="0" stopColor="#fbd9a4" />
              <stop offset="0.5" stopColor="#f0c48c" />
              <stop offset="1" stopColor="#d19f66" />
            </linearGradient>
            <linearGradient id="a-we" x1="0" y1="0" x2="1" y2="0.6">
              <stop offset="0" stopColor="#c98f52" />
              <stop offset="1" stopColor="#8d5f31" />
            </linearGradient>
            <linearGradient id="a-pL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#bf8a4e" />
              <stop offset="1" stopColor="#8a5a30" />
            </linearGradient>
            <linearGradient id="a-pR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#9a6636" />
              <stop offset="1" stopColor="#6f4522" />
            </linearGradient>
            <radialGradient id="a-mt" cx="0.34" cy="0.28" r="0.85">
              <stop offset="0" stopColor="#d6f5ee" />
              <stop offset="0.45" stopColor="#8FD4C8" />
              <stop offset="1" stopColor="#3f9c8c" />
            </radialGradient>
            <radialGradient id="a-yl" cx="0.34" cy="0.28" r="0.85">
              <stop offset="0" stopColor="#ffeeb8" />
              <stop offset="0.45" stopColor="#ffd166" />
              <stop offset="1" stopColor="#c98a00" />
            </radialGradient>
            <radialGradient id="a-cr" cx="0.34" cy="0.28" r="0.85">
              <stop offset="0" stopColor="#ffd3de" />
              <stop offset="0.45" stopColor="#ff9db5" />
              <stop offset="1" stopColor="#e85d82" />
            </radialGradient>
            <radialGradient id="a-sg" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffe08a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffd166" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="a-sh" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#3c5c2e" stopOpacity="0.42" />
              <stop offset="0.6" stopColor="#3c5c2e" stopOpacity="0.16" />
              <stop offset="1" stopColor="#3c5c2e" stopOpacity="0" />
            </radialGradient>
            <clipPath id="a-fr">
              <rect x="0" y="0" width="680" height="430" rx="12" />
            </clipPath>
          </defs>
          <g clipPath="url(#a-fr)">
            <rect x="0" y="0" width="680" height="430" fill="url(#a-sky)" />
            <circle cx="572" cy="62" r="70" fill="url(#a-sg)" />
            <circle cx="572" cy="62" r="24" fill="#ffe9a3" />
            <circle cx="566" cy="56" r="16" fill="#fff6d4" opacity="0.8" />

            <g id="gm-cl1">
              <ellipse cx="128" cy="78" rx="54" ry="17" fill="#fffdf8" />
              <ellipse cx="98" cy="84" rx="34" ry="12" fill="#f6e8d4" opacity="0.7" />
              <ellipse cx="166" cy="70" rx="34" ry="14" fill="#fffefb" />
            </g>
            <g id="gm-cl2">
              <ellipse cx="428" cy="50" rx="44" ry="14" fill="#fffdf8" opacity="0.8" />
            </g>

            <path
              d="M-20 212 Q90 158 210 190 Q330 222 430 178 Q540 132 700 176 L700 430 L-20 430 Z"
              fill="url(#a-h1)"
            />
            <path
              d="M-20 248 Q110 202 240 234 Q360 264 470 226 Q580 190 700 228 L700 430 L-20 430 Z"
              fill="url(#a-h2)"
            />
            <path
              d="M-20 248 Q110 202 240 234 Q360 264 470 226 Q580 190 700 228 L700 240 Q580 204 470 240 Q360 278 240 248 Q110 216 -20 262 Z"
              fill="#dbf0c4"
              opacity="0.5"
            />
            <path
              d="M-20 302 Q120 260 260 292 Q400 324 520 286 Q620 256 700 288 L700 430 L-20 430 Z"
              fill="url(#a-h3)"
            />
            <path
              d="M-20 302 Q120 260 260 292 Q400 324 520 286 Q620 256 700 288 L700 296 Q620 266 520 296 Q400 334 260 302 Q120 270 -20 312 Z"
              fill="#c7ebab"
              opacity="0.55"
            />
            <path
              d="M-20 364 Q160 324 320 354 Q480 384 700 346 L700 430 L-20 430 Z"
              fill="url(#a-h4)"
            />
            <path
              d="M-20 364 Q160 324 320 354 Q480 384 700 346 L700 354 Q480 392 320 362 Q160 332 -20 372 Z"
              fill="#9ed184"
              opacity="0.5"
            />

            <g id="gm-grass" opacity="0.45" stroke="#3f7a30" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M38 402 q7 -22 2 -36" />
              <path d="M52 404 q11 -20 20 -30" />
              <path d="M98 398 q-5 -24 -13 -34" />
              <path d="M604 398 q9 -22 4 -34" />
              <path d="M632 404 q-7 -20 -15 -28" />
              <path d="M652 400 q11 -18 21 -26" />
              <path d="M296 426 q7 -20 2 -32" />
              <path d="M344 428 q-7 -18 -13 -26" />
            </g>

            <g className="gm-p" style={{ transformOrigin: '120px 120px' }}>
              <path d="M120 120 q9 -7 16 2 q-9 9 -16 -2 Z" fill="#ff9db5" />
            </g>
            <g className="gm-p gm-p2" style={{ transformOrigin: '250px 90px' }}>
              <path d="M250 90 q9 -7 16 2 q-9 9 -16 -2 Z" fill="#ffd166" />
            </g>
            <g className="gm-p gm-p3" style={{ transformOrigin: '400px 150px' }}>
              <path d="M400 150 q8 -6 14 2 q-8 8 -14 -2 Z" fill="#ff9db5" />
            </g>
            <g className="gm-p gm-p4" style={{ transformOrigin: '60px 200px' }}>
              <path d="M60 200 q8 -6 14 2 q-8 8 -14 -2 Z" fill="#ffd166" />
            </g>

            <g id="gm-k1">
              <ellipse cx="141" cy="197" rx="13" ry="4.5" fill="url(#a-sh)" />
              <ellipse cx="140" cy="184" rx="14" ry="13" fill="url(#a-mt)" />
              <ellipse cx="140" cy="190" rx="10" ry="5" fill="#2f8878" opacity="0.18" />
              <ellipse cx="135" cy="177" rx="4.5" ry="3" fill="#fff" opacity="0.5" />
              <path d="M132 172 q-3 -9 4 -5" stroke="#5cb8a8" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path d="M148 172 q3 -9 -4 -5" stroke="#5cb8a8" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <circle cx="135" cy="182" r="2.2" fill="#4a4045" />
              <circle cx="145" cy="182" r="2.2" fill="#4a4045" />
              <circle cx="135.8" cy="181.2" r="0.7" fill="#fff" />
              <circle cx="145.8" cy="181.2" r="0.7" fill="#fff" />
              <path d="M137 189 q3 2.5 6 0" stroke="#4a4045" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <circle cx="128" cy="187" r="2.2" fill="#ff7a9c" opacity="0.4" />
              <circle cx="152" cy="187" r="2.2" fill="#ff7a9c" opacity="0.4" />
            </g>

            <g id="gm-k2">
              <ellipse cx="514" cy="239" rx="16" ry="5.5" fill="url(#a-sh)" />
              <ellipse cx="512" cy="222" rx="18" ry="17" fill="url(#a-yl)" />
              <ellipse cx="512" cy="230" rx="13" ry="6" fill="#a86f00" opacity="0.16" />
              <ellipse cx="505" cy="213" rx="6" ry="4" fill="#fff" opacity="0.45" />
              <path d="M501 207 q-4 -11 5 -6" stroke="#f0b93f" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M523 207 q4 -11 -5 -6" stroke="#f0b93f" strokeWidth="4" fill="none" strokeLinecap="round" />
              <circle cx="506" cy="220" r="2.8" fill="#4a4045" />
              <circle cx="518" cy="220" r="2.8" fill="#4a4045" />
              <circle cx="507" cy="219" r="0.9" fill="#fff" />
              <circle cx="519" cy="219" r="0.9" fill="#fff" />
              <path d="M508 229 q4 3 8 0" stroke="#4a4045" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <circle cx="497" cy="226" r="2.8" fill="#ff7a9c" opacity="0.4" />
              <circle cx="527" cy="226" r="2.8" fill="#ff7a9c" opacity="0.4" />
            </g>

            <g id="gm-k3">
              <ellipse cx="628" cy="324" rx="18" ry="6" fill="url(#a-sh)" />
              <ellipse cx="626" cy="304" rx="20" ry="19" fill="url(#a-cr)" />
              <ellipse cx="626" cy="313" rx="14" ry="6.5" fill="#c94467" opacity="0.16" />
              <ellipse cx="618" cy="294" rx="6.5" ry="4.5" fill="#fff" opacity="0.45" />
              <path d="M614 288 q-5 -12 6 -7" stroke="#ffb3c6" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <path d="M638 288 q5 -12 -6 -7" stroke="#ffb3c6" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <circle cx="619" cy="302" r="3" fill="#4a4045" />
              <circle cx="633" cy="302" r="3" fill="#4a4045" />
              <circle cx="620.2" cy="300.8" r="1" fill="#fff" />
              <circle cx="634.2" cy="300.8" r="1" fill="#fff" />
              <path d="M621 312 q5 3.5 10 0" stroke="#4a4045" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <circle cx="609" cy="308" r="3" fill="#e85d82" opacity="0.35" />
              <circle cx="643" cy="308" r="3" fill="#e85d82" opacity="0.35" />
            </g>

            <g id="gm-k4">
              <ellipse cx="68" cy="355" rx="22" ry="7" fill="url(#a-sh)" />
              <ellipse cx="66" cy="332" rx="23" ry="22" fill="url(#a-mt)" />
              <ellipse cx="66" cy="342" rx="16" ry="7.5" fill="#2f8878" opacity="0.18" />
              <ellipse cx="57" cy="321" rx="7.5" ry="5" fill="#fff" opacity="0.45" />
              <path d="M52 314 q-6 -14 7 -8" stroke="#5cb8a8" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M80 314 q6 -14 -7 -8" stroke="#5cb8a8" strokeWidth="5" fill="none" strokeLinecap="round" />
              <circle cx="58" cy="330" r="3.4" fill="#4a4045" />
              <circle cx="74" cy="330" r="3.4" fill="#4a4045" />
              <circle cx="59.4" cy="328.6" r="1.1" fill="#fff" />
              <circle cx="75.4" cy="328.6" r="1.1" fill="#fff" />
              <path d="M61 341 q5 4 10 0" stroke="#4a4045" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <circle cx="48" cy="337" r="3.4" fill="#ff7a9c" opacity="0.4" />
              <circle cx="84" cy="337" r="3.4" fill="#ff7a9c" opacity="0.4" />
            </g>

            <ellipse cx="344" cy="416" rx="132" ry="15" fill="url(#a-sh)" />
            <path d="M326 330 L338 330 L340 416 L328 416 Z" fill="url(#a-pL)" />
            <path d="M338 330 L350 330 L350 416 L340 416 Z" fill="url(#a-pR)" />
            <path d="M320 342 L360 342 L360 350 L320 350 Z" fill="#7a4d28" />
            <path d="M320 342 L360 342 L360 345 L320 345 Z" fill="#a9713f" />

            <g id="gm-sign">
              <path d="M150 344 L530 344 L536 336 L156 336 Z" fill="#7d5330" />
              <rect x="150" y="96" width="380" height="248" rx="14" fill="url(#a-we)" />
              <rect x="156" y="100" width="368" height="238" rx="11" fill="url(#a-wf)" />
              <path d="M156 100 L524 100 L524 110 Q340 118 156 110 Z" fill="#fff2d8" opacity="0.55" />
              <path d="M156 320 Q340 330 524 320 L524 338 L156 338 Z" fill="#b8834a" opacity="0.35" />
              <g opacity="0.3" stroke="#c07f42" strokeWidth="1" fill="none">
                <path d="M168 142 q90 -9 180 0 q90 9 158 0" />
                <path d="M168 212 q100 9 180 0 q80 -9 158 0" />
                <path d="M168 296 q90 -7 180 0 q90 7 158 0" />
              </g>
              <circle cx="176" cy="122" r="4.5" fill="#8d5f31" />
              <circle cx="175" cy="121" r="2" fill="#c99356" />
              <circle cx="504" cy="122" r="4.5" fill="#8d5f31" />
              <circle cx="503" cy="121" r="2" fill="#c99356" />
              <circle cx="176" cy="316" r="4.5" fill="#8d5f31" />
              <circle cx="175" cy="315" r="2" fill="#c99356" />
              <circle cx="504" cy="316" r="4.5" fill="#8d5f31" />
              <circle cx="503" cy="315" r="2" fill="#c99356" />
              <text x="340" y="154" textAnchor="middle" fill="#6b4a2a" fontFamily="'Do Hyeon',sans-serif" fontSize="30" opacity="0.3">
                그로우미
              </text>
              <text x="340" y="152" textAnchor="middle" fill="#4a4045" fontFamily="'Do Hyeon',sans-serif" fontSize="30">
                그로우미
              </text>
              <text x="340" y="176" textAnchor="middle" fill="#8a6a4a" fontFamily="'Pretendard',sans-serif" fontSize="13">
                오늘의 몰입이 꾸미를 자라게 해요
              </text>
              <g id="gm-k5">
                <ellipse cx="454" cy="127" rx="16" ry="5" fill="#8d5f31" opacity="0.25" />
                <ellipse cx="452" cy="112" rx="17" ry="16" fill="url(#a-mt)" />
                <ellipse cx="452" cy="120" rx="12" ry="5.5" fill="#2f8878" opacity="0.18" />
                <ellipse cx="445" cy="104" rx="6" ry="4" fill="#fff" opacity="0.45" />
                <path d="M441 97 q-4 -11 5 -6" stroke="#5cb8a8" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M463 97 q4 -11 -5 -6" stroke="#5cb8a8" strokeWidth="4" fill="none" strokeLinecap="round" />
                <circle cx="446" cy="110" r="2.6" fill="#4a4045" />
                <circle cx="458" cy="110" r="2.6" fill="#4a4045" />
                <circle cx="447.2" cy="109" r="0.9" fill="#fff" />
                <circle cx="459.2" cy="109" r="0.9" fill="#fff" />
                <path d="M448 119 q4 3 8 0" stroke="#4a4045" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                <circle cx="437" cy="116" r="2.6" fill="#ff7a9c" opacity="0.4" />
                <circle cx="467" cy="116" r="2.6" fill="#ff7a9c" opacity="0.4" />
              </g>
            </g>
          </g>
        </svg>

        <form onSubmit={handleSubmit} className="absolute inset-0">
          <div className="absolute" style={{ left: '28.8%', top: '45.1%', width: '42.4%', height: '8.8%' }}>
            <label htmlFor="email" className="sr-only">
              이메일
            </label>
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              className="w-full h-full rounded-md bg-white/70 border border-[#c08a52] px-3 text-sm text-ink placeholder:text-[#a08a76] focus:outline-none focus:ring-2 focus:ring-coral/40"
            />
          </div>
          <div className="absolute" style={{ left: '28.8%', top: '55.8%', width: '42.4%', height: '8.8%' }}>
            <label htmlFor="password" className="sr-only">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full h-full rounded-md bg-white/70 border border-[#c08a52] px-3 text-sm text-ink placeholder:text-[#a08a76] focus:outline-none focus:ring-2 focus:ring-coral/40"
            />
          </div>
          <button
            type="submit"
            className="absolute font-display text-white rounded-md"
            style={{
              left: '28.8%',
              top: '67%',
              width: '42.4%',
              height: '9.3%',
              background: 'linear-gradient(180deg,#ff9db5,#e85d82)',
            }}
          >
            시작하기
          </button>
          {error && (
            <p role="alert" className="absolute text-xs text-coral-dark" style={{ left: '28.8%', top: '80%' }}>
              {error}
            </p>
          )}
        </form>

        <p className="absolute text-xs text-[#2f5c24]" style={{ left: '50%', bottom: '2%', transform: 'translateX(-50%)' }}>
          아직 계정이 없나요?{' '}
          <Link to="/signup" className="font-medium underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: FAIL — 버튼 텍스트가 "로그인"에서 "시작하기"로 바뀌어 기존 테스트의 `screen.getByText('로그인')`이 못 찾음. `frontend/src/pages/LoginPage.test.tsx`의 다음:
```ts
    fireEvent.click(screen.getByText('로그인'));
```
을 다음으로 교체:
```ts
    fireEvent.click(screen.getByText('시작하기'));
```
수정 후 재실행하면 PASS(동작은 동일, 버튼 라벨만 변경).

- [ ] **Step 4: 전체 프론트 테스트 회귀 확인**

Run: `cd frontend && npx vitest run`
Expected: 전부 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/LoginPage.test.tsx
git commit -m "feat: 로그인 화면을 애니메이션 나무 팻말 배경 목업으로 교체"
```

---

### Task 7: HomePage — 대시보드 목업 이식

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `KkumiCharacter`(Task 3), `getMyGrowth`, `useDailyTotals`, `computeCurrentStreak`(기존), `getHistory('6months')`(Task 5).

목업(`growme_home_screen_dashboard.html`)의 2컬럼(히어로+사이드) + 하단 히트맵 레이아웃을 이식하되, 스펙 문서(`2026-07-16-design-asset-integration-design.md`)가 정한 대로: 진행바는 100% 고정 장식(정확한 %는 후속), 뱃지 5칸은 전부 잠금 아이콘, 히트맵은 `range=6months` 실데이터.

- [ ] **Step 1: 기존 테스트를 새 마크업 기준으로 수정 (먼저 테스트, 실패 확인 후 구현)**

`frontend/src/pages/HomePage.test.tsx` 전체를 다음으로 교체:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current category and computed stats', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ date: new Date().toISOString().slice(0, 10), category: 'STUDY', verifiedSeconds: 600 }],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' }),
      });
    }) as any;

    render(
      <AuthProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('꾸미')).toBeInTheDocument();
      expect(screen.getByText('1일')).toBeInTheDocument();
      expect(screen.getByText('1h')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/pages/HomePage.test.tsx`
Expected: FAIL — 현재 마크업엔 "꾸미"라는 고정 텍스트가 없음(`{growth.dominantCategory} 꾸미`로 합쳐진 텍스트라 `getByText('꾸미')`가 못 찾음)

- [ ] **Step 3: `HomePage.tsx` 전체 교체**

`frontend/src/pages/HomePage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';
import { getHistory } from '../api/history';
import Layout from '../components/Layout';
import { KkumiCharacter } from '../components/KkumiCharacter';
import { useDailyTotals } from '../hooks/useDailyTotals';
import { computeCurrentStreak } from '../utils/streak';
import { IconFlame, IconClock, IconLock } from '@tabler/icons-react';

const STAGE_LABEL = ['알', '부화', '아기', '성장', '성장'];

function colorForSeconds(seconds: number) {
  if (seconds <= 0) return '#f2e6d4';
  if (seconds < 900) return '#cfeee7';
  if (seconds < 1800) return '#8FD4C8';
  if (seconds < 3600) return '#5cb8a8';
  return '#3f9c8c';
}

export default function HomePage() {
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [sixMonthTotals, setSixMonthTotals] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { totalsByDate } = useDailyTotals('weekly');

  useEffect(() => {
    async function fetchGrowth() {
      try {
        const data = await getMyGrowth();
        setGrowth(data);
      } catch {
        setError('성장 정보를 불러오지 못했어요');
      }
    }
    fetchGrowth();
  }, []);

  useEffect(() => {
    async function fetchSixMonths() {
      try {
        const entries = await getHistory('6months');
        const totals: Record<string, number> = {};
        for (const e of entries) {
          totals[e.date] = (totals[e.date] ?? 0) + e.verifiedSeconds;
        }
        setSixMonthTotals(totals);
      } catch {
        // 히트맵은 부가 정보이므로 실패해도 페이지 전체를 에러로 만들지 않는다
      }
    }
    fetchSixMonths();
  }, []);

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }
  if (!growth) {
    return (
      <Layout>
        <p className="text-ink-soft">불러오는 중...</p>
      </Layout>
    );
  }

  const streak = computeCurrentStreak(totalsByDate);
  const accumulatedHours = Math.floor(growth.currentGauge / 3600);
  const weekSeconds = Object.values(totalsByDate).reduce((a, b) => a + b, 0);
  const weekHours = Math.floor(weekSeconds / 3600);

  const days: string[] = [];
  const today = new Date();
  for (let i = 181; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <Layout>
      <div className="w-full grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-4">
        <div className="relative rounded-card overflow-hidden bg-[#f3f9ea]">
          <div className="w-40 h-40 mx-auto py-6">
            <KkumiCharacter stage={growth.stage} category={growth.dominantCategory} radius={50} />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="bg-card-bg border border-card-border rounded-card p-3">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-lg text-ink">꾸미</span>
              <span className="text-xs bg-coral-light text-coral-dark px-2 py-0.5 rounded-full">
                Lv.{growth.stage} · {STAGE_LABEL[Math.min(growth.stage, 4)]}
              </span>
            </div>
            <div className="h-2 bg-cream-dark rounded-full overflow-hidden my-2">
              <div className="h-full w-full bg-gradient-to-r from-[#ff9db5] to-coral rounded-full" />
            </div>
            <div className="flex justify-between text-xs text-ink-soft">
              <span>누적 게이지</span>
              <span>{accumulatedHours}h</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
              <div className="font-display text-xl text-ink">{streak}일</div>
              <div className="text-[10px] text-ink-soft mt-0.5">연속일</div>
            </div>
            <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
              <div className="font-display text-xl text-ink">{accumulatedHours}h</div>
              <div className="text-[10px] text-ink-soft mt-0.5">누적시간</div>
            </div>
            <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
              <div className="font-display text-xl text-ink">{weekHours}h</div>
              <div className="text-[10px] text-ink-soft mt-0.5">이번주</div>
            </div>
          </div>

          <div className="bg-card-bg border border-card-border rounded-card p-3">
            <p className="text-xs text-tan-dark mb-2">뱃지</p>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-card-border bg-[#f6efe4] text-[#cbb99f]"
                >
                  <IconLock size={16} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/activities')}
            className="w-full rounded-lg py-3 font-display text-cream"
            style={{ background: 'linear-gradient(180deg,#ff9db5,#e85d82)' }}
          >
            몰입 시작하기 ↗
          </button>
        </div>
      </div>

      <div className="bg-card-bg border border-card-border rounded-card p-3 mt-3 w-full">
        <p className="text-xs text-tan-dark mb-2">최근 6개월 몰입 기록</p>
        <div className="grid gap-[2.5px]" style={{ gridTemplateColumns: 'repeat(26, 1fr)' }}>
          {days.map((date) => (
            <div
              key={date}
              title={`${date}: ${Math.round((sixMonthTotals[date] ?? 0) / 60)}분`}
              className="aspect-square rounded-[2px]"
              style={{ background: colorForSeconds(sixMonthTotals[date] ?? 0) }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 justify-end mt-2 text-[10px] text-ink-soft">
          <IconFlame size={12} />
          <span>적음</span>
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f2e6d4' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#cfeee7' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#8FD4C8' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#5cb8a8' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3f9c8c' }} />
          <span>많음</span>
          <IconClock size={12} />
        </div>
      </div>
    </Layout>
  );
}
```

**참고**: `ActivityHeatmap` 컴포넌트(V1, 28일 히트맵)는 이 페이지에서 더 이상 쓰지 않는다 — 182일 히트맵으로 대체됐다. 다른 페이지에서 쓰지 않는다면 죽은 코드로 남지만 이번 범위에서 삭제하지 않는다(스펙의 "범위 밖" 원칙과 동일하게, 필요 이상으로 건드리지 않는다).

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/HomePage.test.tsx`
Expected: PASS

- [ ] **Step 5: 전체 프론트 테스트 회귀 확인**

Run: `cd frontend && npx vitest run`
Expected: `App.test.tsx`가 `/STUDY/` 텍스트를 찾는데 이 새 마크업엔 카테고리 영문명이 안 보이므로 FAIL. `frontend/src/App.test.tsx`의 다음:
```ts
    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
    });
```
을 다음으로 교체:
```ts
    await waitFor(() => {
      expect(screen.getByText('꾸미')).toBeInTheDocument();
    });
```
수정 후 재실행하면 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/HomePage.test.tsx frontend/src/App.test.tsx
git commit -m "feat: 홈 화면을 대시보드 목업(2컬럼+6개월 히트맵)으로 교체"
```

---

### Task 8: HistoryPage — 필터+세션 리스트 목업 이식

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`
- Modify: `frontend/src/pages/HistoryPage.test.tsx`

**Interfaces:**
- Consumes: `getHistory('6months')`(날짜별 그룹핑을 프론트에서 하려면 daily/weekly보다 넓은 범위가 유리하지만, 목업은 개별 세션 단위 표시가 필요 — 이번 태스크는 **세션 단위 API가 없다는 제약**을 반영해 `getHistory`의 날짜×카테고리 집계 엔트리를 "세션처럼" 하루-카테고리 단위 행으로 표시한다. 정확한 개별 세션 목록 API는 범위 밖).

목업의 필터 pill + 날짜 그룹 + 진행바 있는 행 레이아웃을 이식하되, 세션 "제목"이 없으므로 카테고리 한글 라벨을 제목으로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/pages/HistoryPage.test.tsx` 전체를 다음으로 교체:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HistoryPage from './HistoryPage';

describe('HistoryPage', () => {
  it('renders grouped entries and filters by category', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { date: '2026-07-13', category: 'STUDY', verifiedSeconds: 600 },
        { date: '2026-07-13', category: 'EXERCISE', verifiedSeconds: 300 },
      ],
    }) as any;

    render(
      <AuthProvider>
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('공부')).toBeInTheDocument();
      expect(screen.getByText('운동')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('공부', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.queryByText('운동')).not.toBeInTheDocument();
    });
  });

  it('shows an empty state when there are no entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }) as any;

    render(
      <AuthProvider>
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('아직 기록이 없어요')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/pages/HistoryPage.test.tsx`
Expected: FAIL — 현재 마크업은 카테고리 필터 버튼이 없음

- [ ] **Step 3: `HistoryPage.tsx` 전체 교체**

`frontend/src/pages/HistoryPage.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';
import Layout from '../components/Layout';
import { IconNotebook, IconRun, IconBook, IconStar } from '@tabler/icons-react';

const CATEGORY_LABEL: Record<string, string> = {
  STUDY: '공부',
  EXERCISE: '운동',
  READING: '독서',
  ETC: '기타',
};

const CATEGORY_STYLE: Record<string, { bg: string; fg: string; Icon: typeof IconNotebook }> = {
  STUDY: { bg: '#e1f5ee', fg: '#3f9c8c', Icon: IconNotebook },
  EXERCISE: { bg: '#ffe9ef', fg: '#e85d82', Icon: IconRun },
  READING: { bg: '#fff3d6', fg: '#c98a00', Icon: IconBook },
  ETC: { bg: '#eeecfa', fg: '#5f52a8', Icon: IconStar },
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'STUDY', label: '공부' },
  { key: 'EXERCISE', label: '운동' },
  { key: 'READING', label: '독서' },
  { key: 'ETC', label: '기타' },
];

const DURATION_NORMALIZE_SECONDS = 120 * 60;

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }
  return `${minutes}분`;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getHistory('6months');
        setEntries(data);
      } catch {
        setError('히스토리를 불러오지 못했어요');
      }
    }
    fetchHistory();
  }, []);

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.category === filter);
  const byDate = new Map<string, HistoryEntry[]>();
  for (const e of [...filtered].sort((a, b) => b.date.localeCompare(a.date))) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  return (
    <Layout>
      <div className="w-full max-w-2xl space-y-1">
        <div className="flex items-end gap-3 mb-3">
          <h1 className="text-lg font-display text-ink mr-auto">활동 기록</h1>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3" role="group" aria-label="카테고리 필터">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`text-xs px-3.5 py-1.5 rounded-full border ${
                filter === f.key ? 'bg-ink border-ink text-cream' : 'bg-card-bg border-card-border text-tan-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {byDate.size === 0 && <p className="text-center text-sm text-ink-soft py-7">아직 기록이 없어요</p>}

        {[...byDate.entries()].map(([date, dayEntries]) => (
          <div key={date}>
            <div className="flex items-center gap-2 text-xs text-ink-soft my-3">
              <span>{date}</span>
              <span className="flex-1 h-px bg-card-border" />
            </div>
            {dayEntries.map((e, i) => {
              const style = CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.ETC;
              const Icon = style.Icon;
              const pct = Math.min(100, (e.verifiedSeconds / DURATION_NORMALIZE_SECONDS) * 100);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 border border-card-border rounded-lg bg-card-bg mb-1.5"
                >
                  <div
                    className="w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink">{CATEGORY_LABEL[e.category] ?? e.category}</div>
                  </div>
                  <div className="w-14 h-1.5 rounded-full bg-cream-dark overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: style.fg }} />
                  </div>
                  <div className="font-display text-sm text-ink shrink-0">{formatDuration(e.verifiedSeconds)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/HistoryPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 전체 프론트 테스트 회귀 확인**

Run: `cd frontend && npx vitest run`
Expected: 전부 PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/HistoryPage.tsx frontend/src/pages/HistoryPage.test.tsx
git commit -m "feat: 히스토리 화면을 필터+날짜그룹 목업으로 교체"
```

---

### Task 9: ProfilePage — 아바타+통계+설정 목업으로 전면 교체

**Files:**
- Modify: `frontend/src/pages/ProfilePage.tsx` (V1.5에서 만든 버전을 이 태스크가 전면 교체)
- Modify: `frontend/src/pages/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `getMe`/`updateMe`/`changePassword`/`deleteMe`(V1.5, 백엔드는 그대로 재사용), `getMyGrowth`, `getHistory('6months')`(카테고리별 집계), `KkumiCharacter`(Task 3).

이 태스크는 V1.5 플랜의 `ProfilePage.tsx`(기본정보+bio+계정설정, 텍스트 위주 레이아웃)를 목업(`growme_profile_screen_account.html`) 기준으로 **시각적으로 전면 교체**한다 — bio 편집, 비밀번호 변경, 회원탈퇴 기능은 V1.5에서 만든 그대로 유지하되 마크업/스타일만 이 목업에 맞춘다.

- [ ] **Step 1: 실패하는 테스트 작성 (V1.5의 기존 테스트를 이 마크업 기준으로 갱신)**

`frontend/src/pages/ProfilePage.test.tsx`를 다음으로 교체(V1.5 버전과 시나리오는 동일, 마크업 변경에 맞춰 셀렉터만 조정):
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProfilePage from './ProfilePage';

function mockFetchSequence(responses: {
  me: any;
  growth: any;
  history?: any[];
  patched?: any;
  changePasswordOk?: boolean;
}) {
  globalThis.fetch = vi.fn((url: string, options?: RequestInit) => {
    if (url.includes('/history')) {
      return Promise.resolve({ ok: true, json: async () => responses.history ?? [] });
    }
    if (url.includes('/growth/me')) {
      return Promise.resolve({ ok: true, json: async () => responses.growth });
    }
    if (url.includes('/auth/change-password')) {
      return Promise.resolve({ ok: responses.changePasswordOk ?? true, json: async () => ({}) });
    }
    if (url.includes('/users/me') && options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => responses.patched ?? responses.me });
    }
    if (url.includes('/users/me') && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url.includes('/users/me')) {
      return Promise.resolve({ ok: true, json: async () => responses.me });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as any;
}

describe('ProfilePage', () => {
  it('shows profile info and category totals', async () => {
    mockFetchSequence({
      me: { id: '1', email: 'a@b.com', nickname: '테스터', bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
      growth: { currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' },
      history: [{ date: '2026-07-01', category: 'STUDY', verifiedSeconds: 3600 }],
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('테스터')).toBeInTheDocument();
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
    });
  });

  it('shows an error message when changing password fails', async () => {
    mockFetchSequence({
      me: { id: '1', email: 'a@b.com', nickname: '테스터', bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
      growth: { currentGauge: 0, stage: 0, dominantCategory: 'ETC' },
      changePasswordOk: false,
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('테스터')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('비밀번호 변경'));

    await waitFor(() => {
      expect(screen.getByText('비밀번호 변경에 실패했어요')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/pages/ProfilePage.test.tsx`
Expected: FAIL — 히스토리 fetch 모킹 분기가 기존 `ProfilePage.tsx`엔 대응하는 호출이 없어 무해하게 통과할 수도 있으나, 새 마크업 요소(카테고리 바 등)가 없어 관련 스텝은 아직 실패

- [ ] **Step 3: `ProfilePage.tsx` 전체 교체**

`frontend/src/pages/ProfilePage.tsx`:
```tsx
import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, getMe, updateMe, changePassword, deleteMe } from '../api/users';
import { GrowthState, getMyGrowth } from '../api/growth';
import { getHistory } from '../api/history';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { KkumiCharacter } from '../components/KkumiCharacter';
import { IconLock, IconBell, IconLogout, IconTrash } from '@tabler/icons-react';

const CATEGORY_LABEL: Record<string, string> = { STUDY: '공부', EXERCISE: '운동', READING: '독서', ETC: '기타' };
const CATEGORY_COLOR: Record<string, string> = {
  STUDY: '#3f9c8c',
  EXERCISE: '#e85d82',
  READING: '#c98a00',
  ETC: '#5f52a8',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [bioSaved, setBioSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [p, g, historyEntries] = await Promise.all([getMe(), getMyGrowth(), getHistory('6months')]);
        setProfile(p);
        setGrowth(g);
        setBioDraft(p.bio ?? '');
        const totals: Record<string, number> = {};
        for (const e of historyEntries) {
          totals[e.category] = (totals[e.category] ?? 0) + e.verifiedSeconds;
        }
        setCategoryTotals(totals);
      } catch {
        setError('프로필을 불러오지 못했어요');
      }
    }
    load();
  }, []);

  async function handleSaveBio(e: FormEvent) {
    e.preventDefault();
    setBioSaved(false);
    try {
      const updated = await updateMe({ bio: bioDraft });
      setProfile(updated);
      setBioSaved(true);
    } catch {
      setError('한줄소개를 저장하지 못했어요');
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('비밀번호를 변경했어요');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPasswordError('비밀번호 변경에 실패했어요');
    }
  }

  async function handleDelete() {
    setDeleteError('');
    try {
      await deleteMe();
      logout();
      navigate('/login');
    } catch {
      setDeleteError('회원탈퇴에 실패했어요');
    }
  }

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }
  if (!profile || !growth) {
    return (
      <Layout>
        <p className="text-ink-soft">불러오는 중...</p>
      </Layout>
    );
  }

  const joined = new Date(profile.createdAt);
  const daysSinceJoin = Math.max(0, Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));
  const joinedLabel = `${joined.getFullYear()}년 ${joined.getMonth() + 1}월 ${joined.getDate()}일 가입 · ${daysSinceJoin}일째`;
  const accumulatedHours = Math.floor(growth.currentGauge / 3600);
  const totalCategorySeconds = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;

  return (
    <Layout>
      <div className="w-full max-w-2xl space-y-3">
        <div className="flex items-center gap-3.5 bg-card-bg border border-card-border rounded-card p-3.5">
          <div className="w-16 h-16 rounded-full bg-[#f3f9ea] shrink-0 overflow-hidden">
            <KkumiCharacter stage={growth.stage} category={growth.dominantCategory} radius={26} />
          </div>
          <div>
            <div className="font-display text-lg text-ink">{profile.nickname}</div>
            <div className="text-xs text-ink-soft mt-0.5">{profile.email}</div>
            <div className="text-[11px] text-tan mt-0.5">{joinedLabel}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
            <div className="font-display text-lg text-ink">{accumulatedHours}h</div>
            <div className="text-[10px] text-ink-soft mt-0.5">누적 시간</div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
            <div className="font-display text-lg text-ink">{growth.stage}</div>
            <div className="text-[10px] text-ink-soft mt-0.5">성장 단계</div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
            <div className="font-display text-lg text-ink">{daysSinceJoin}일</div>
            <div className="text-[10px] text-ink-soft mt-0.5">가입 경과</div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-card p-2.5 text-center">
            <div className="font-display text-lg text-ink">0</div>
            <div className="text-[10px] text-ink-soft mt-0.5">획득 뱃지</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-card-bg border border-card-border rounded-card p-3.5">
            <p className="text-xs text-tan-dark mb-2.5">카테고리별 누적</p>
            {(['STUDY', 'EXERCISE', 'READING', 'ETC'] as const).map((cat) => {
              const seconds = categoryTotals[cat] ?? 0;
              const pct = (seconds / totalCategorySeconds) * 100;
              return (
                <div key={cat} className="flex items-center gap-2 mb-2 last:mb-0">
                  <span className="text-xs text-ink w-9">{CATEGORY_LABEL[cat]}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-cream-dark overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLOR[cat] }} />
                  </div>
                  <span className="text-[11px] text-ink-soft w-10 text-right">{Math.round(seconds / 3600)}h</span>
                </div>
              );
            })}
          </div>

          <div className="bg-card-bg border border-card-border rounded-card p-3.5">
            <p className="text-xs text-tan-dark mb-2.5">계정 설정</p>
            <form onSubmit={handleChangePassword} className="space-y-2 pb-2.5 border-b border-[#f6efe4]">
              <div className="flex items-center gap-2 text-sm text-ink">
                <IconLock size={16} className="text-tan" />
                비밀번호 변경
              </div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호"
                aria-label="현재 비밀번호"
                className="w-full rounded-lg border border-card-border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-coral/40"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호"
                aria-label="새 비밀번호"
                className="w-full rounded-lg border border-card-border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-coral/40"
              />
              <button type="submit" className="text-xs bg-ink text-cream rounded-full px-3 py-1.5">
                비밀번호 변경
              </button>
              {passwordMessage && <p className="text-xs text-mint-dark">{passwordMessage}</p>}
              {passwordError && <p className="text-xs text-coral-dark">{passwordError}</p>}
            </form>

            <div className="flex items-center gap-2 text-sm text-ink-soft py-2.5 border-b border-[#f6efe4]">
              <IconBell size={16} className="text-tan" />
              알림 설정 (준비 중)
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full flex items-center gap-2 text-sm text-ink py-2.5 border-b border-[#f6efe4]"
            >
              <IconLogout size={16} className="text-tan" />
              로그아웃
            </button>

            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full flex items-center gap-2 text-sm text-coral-dark py-2.5"
              >
                <IconTrash size={16} className="text-coral-dark" />
                회원탈퇴
              </button>
            ) : (
              <div className="py-2.5 space-y-2">
                <p className="text-xs text-ink-soft">정말 탈퇴하시겠어요? 모든 기록이 삭제됩니다.</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="bg-coral-dark text-white text-xs rounded-full px-3 py-1.5">
                    탈퇴할게요
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} className="text-xs text-ink-soft">
                    취소
                  </button>
                </div>
                {deleteError && <p className="text-xs text-coral-dark">{deleteError}</p>}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveBio} className="bg-card-bg border border-card-border rounded-card p-3.5 space-y-2">
          <label htmlFor="bio" className="block text-xs text-tan-dark">
            한줄소개
          </label>
          <input
            id="bio"
            value={bioDraft}
            maxLength={60}
            onChange={(e) => setBioDraft(e.target.value)}
            placeholder="한줄소개를 남겨보세요"
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
          <button type="submit" className="text-xs bg-coral text-white rounded-full px-3 py-1.5">
            저장
          </button>
          {bioSaved && <p className="text-xs text-mint-dark">저장했어요</p>}
        </form>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/ProfilePage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 전체 프론트 테스트 + 타입체크**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 전부 PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ProfilePage.tsx frontend/src/pages/ProfilePage.test.tsx
git commit -m "feat: 프로필 화면을 아바타+통계+계정설정 목업으로 교체"
```

---

### Task 10: 최종 회귀 + `html/` 폴더 삭제

**Files:**
- Delete: `html/` (전체)

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd backend && npm test`
Expected: 전부 PASS

- [ ] **Step 2: 프론트 전체 테스트 + 타입체크**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 전부 PASS

- [ ] **Step 3: `html/` 폴더 삭제**

Run: `git rm -r html/`
Expected: 5개 파일이 스테이징에서 삭제로 표시됨

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: 이식 완료된 html/ 목업 폴더 삭제"
```

- [ ] **Step 5: 개발 서버로 수동 확인 (사람 또는 브라우저 가능한 도구가 수행)**

로그인 화면 애니메이션(꾸미들이 뛰노는지, 팻말이 흔들리는지) → 실제 로그인 폼이 팻말 위치에 잘 겹쳐 보이는지 → 홈 화면 히어로/스탯/히트맵 → 히스토리 필터 동작 → 프로필 아바타/카테고리 바 확인.

Expected: 목업과 동등한 시각적 결과.
