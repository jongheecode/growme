# V1 UI 디자인 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그로우미 프론트엔드 전 페이지에 하나의 디자인 언어(Do Hyeon 포인트 폰트, 대칭형 커스텀 SVG 아이콘, 게임형 스탯 배지)를 적용해 지금의 밋밋한 톤을 고친다.

**Architecture:** 순수 프론트엔드(React + Tailwind v4) 작업. 새 재사용 컴포넌트(아이콘, StatBadge)와 훅(useDailyTotals)을 먼저 만들고, 각 페이지는 기존 데이터 흐름을 유지한 채 그 컴포넌트들로 교체한다. 백엔드 변경 없음 — 스트릭/누적시간은 이미 있는 API 응답(`getHistory`, `getMyGrowth`)만으로 프론트에서 계산한다. 뱃지 개수만 아직 실제 데이터가 없어 정직하게 `0개`로 고정 표시한다(V2에서 `GET /api/badges/me` 연동 예정).

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Vitest + @testing-library/react, react-router-dom v6.

## Global Constraints

- 본문 텍스트는 계속 Pretendard(`font-sans`, 변경 없음). `font-display`(Do Hyeon)는 제목·버튼·숫자 등 포인트에만 적용한다.
- 이모지는 코드베이스에서 전부 제거한다 (스펙 문서 `docs/superpowers/specs/2026-07-15-v1-ui-design-system-design.md` 참고).
- 기존 테스트(`App.test.tsx`, `HomePage.test.tsx`, `LoginPage.test.tsx`, `ActivitySelectPage.test.tsx`, `HistoryPage.test.tsx`)는 의도된 텍스트 변경 외에는 깨지면 안 된다.
- 조작된(fabricated) 데이터를 화면에 표시하지 않는다 — 실데이터가 없는 값(뱃지 개수)은 정직하게 0으로 표시하고, 프론트에서 계산 가능한 값(연속일·누적시간)은 실제로 계산한다.

---

## 파일 구조

**신규 생성**
- `frontend/src/components/icons/BoltIcon.tsx` — 연속일 아이콘
- `frontend/src/components/icons/ClockIcon.tsx` — 누적시간 아이콘
- `frontend/src/components/icons/StarIcon.tsx` — 뱃지 아이콘 (ActivitySelectPage에서 ETC 카테고리 아이콘으로도 재사용)
- `frontend/src/components/icons/DumbbellIcon.tsx` — EXERCISE 카테고리 아이콘
- `frontend/src/components/icons/PencilIcon.tsx` — STUDY 카테고리 아이콘
- `frontend/src/components/icons/OpenBookIcon.tsx` — READING 카테고리 아이콘
- `frontend/src/components/icons/icons.test.tsx` — 6개 아이콘 렌더 스모크 테스트
- `frontend/src/components/StatBadge.tsx` — 아이콘+숫자+라벨 배지
- `frontend/src/components/StatBadge.test.tsx`
- `frontend/src/hooks/useDailyTotals.ts` — 날짜별 인증시간 합계를 가져오는 공용 훅 (`ActivityHeatmap`과 신규 스트릭 계산이 공유)
- `frontend/src/hooks/useDailyTotals.test.ts`
- `frontend/src/utils/streak.ts` — `computeCurrentStreak(totalsByDate, today)` 순수 함수
- `frontend/src/utils/streak.test.ts`
- `frontend/src/pages/TimerPage.test.tsx` — 신규 (기존에 테스트 없었음)

**수정**
- `frontend/index.html` — Google Fonts 링크 추가
- `frontend/src/index.css` — `--font-display`, `--color-honey-dark` 토큰 추가
- `frontend/vite.config.ts` — PWA manifest `theme_color` 수정
- `frontend/src/components/KkumiCharacter.tsx` — `CATEGORY_TINT` export
- `frontend/src/components/ActivityHeatmap.tsx` — 자체 fetch 로직을 `useDailyTotals` 훅으로 교체
- `frontend/src/components/Layout.tsx` — 헤더 로고에 `font-display` 적용
- `frontend/src/pages/HomePage.tsx` + `HomePage.test.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/ActivitySelectPage.tsx`
- `frontend/src/pages/TimerPage.tsx`
- `frontend/src/pages/HistoryPage.tsx`

---

### Task 1: 디자인 토큰 (폰트 · 색상 · manifest)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`
- Modify: `frontend/vite.config.ts:16`

**Interfaces:**
- Produces: Tailwind 유틸리티 클래스 `font-display`(Do Hyeon), `text-honey-dark`/`bg-honey-dark`(#c98a00) — 이후 모든 태스크가 사용.

- [ ] **Step 1: `index.html`에 Google Fonts 링크 추가**

`frontend/index.html`의 `<head>`를 다음으로 교체:

```html
<head>
    <meta charset="UTF-8" />
    <title>그로우미</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap" rel="stylesheet" />
</head>
```

- [ ] **Step 2: `index.css`에 `--font-display`, `--color-honey-dark` 토큰 추가**

`frontend/src/index.css`의 `@theme` 블록에 다음 두 줄 추가 (기존 `--font-sans` 아래, `--radius-card` 위):

```css
  --font-display: 'Do Hyeon', 'Pretendard', 'Apple SD Gothic Neo', system-ui, sans-serif;
  --color-honey-dark: #c98a00;
```

- [ ] **Step 3: PWA manifest `theme_color`를 코랄로 변경**

`frontend/vite.config.ts:16`:
```ts
        theme_color: '#22c55e',
```
을
```ts
        theme_color: '#ff7a9c',
```
로 교체.

- [ ] **Step 4: 개발 서버로 폰트/색이 로드되는지 확인**

Run: `cd frontend && npm run dev` (몇 초 후 Ctrl+C로 종료해도 됨 — 여기선 그냥 빌드 에러 없이 뜨는지만 확인)
Expected: 에러 없이 Vite dev 서버가 뜬다.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/src/index.css frontend/vite.config.ts
git commit -m "feat: Do Hyeon 폰트·honey-dark 토큰 추가, PWA 테마색 코랄로 변경"
```

---

### Task 2: 스탯 아이콘 (번개 · 시계 · 별)

**Files:**
- Create: `frontend/src/components/icons/BoltIcon.tsx`
- Create: `frontend/src/components/icons/ClockIcon.tsx`
- Create: `frontend/src/components/icons/StarIcon.tsx`
- Create: `frontend/src/components/icons/icons.test.tsx`

**Interfaces:**
- Produces: `BoltIcon`, `ClockIcon`, `StarIcon` — 각각 `(props: { className?: string; color?: string }) => JSX.Element`, 기본 `color = 'currentColor'`. Task 5(StatBadge), Task 6(HomePage), Task 8(ActivitySelectPage — StarIcon을 ETC로 재사용)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/icons/icons.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BoltIcon } from './BoltIcon';
import { ClockIcon } from './ClockIcon';
import { StarIcon } from './StarIcon';

describe('stat icons', () => {
  it('renders BoltIcon as an svg with the given color', () => {
    const { container } = render(<BoltIcon color="#e85d82" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.querySelector('polygon')).toHaveAttribute('fill', '#e85d82');
  });

  it('renders ClockIcon as an svg with the given color', () => {
    const { container } = render(<ClockIcon color="#3fbf99" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#3fbf99');
  });

  it('renders StarIcon as an svg with the given color', () => {
    const { container } = render(<StarIcon color="#c98a00" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('path')).toHaveAttribute('fill', '#c98a00');
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/components/icons/icons.test.tsx`
Expected: FAIL — `Failed to resolve import "./BoltIcon"` (파일이 아직 없음)

- [ ] **Step 3: 세 아이콘 컴포넌트 구현**

`frontend/src/components/icons/BoltIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function BoltIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={color} />
    </svg>
  );
}
```

`frontend/src/components/icons/ClockIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function ClockIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="2" />
      <path d="M12 7v5l3.2 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

`frontend/src/components/icons/StarIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function StarIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 2 14.47 8.60 21.51 8.91 15.99 13.30 17.88 20.09 12 16.2 6.12 20.09 8.01 13.30 2.49 8.91 9.53 8.60 Z"
        fill={color}
      />
    </svg>
  );
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/components/icons/icons.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/icons/BoltIcon.tsx frontend/src/components/icons/ClockIcon.tsx frontend/src/components/icons/StarIcon.tsx frontend/src/components/icons/icons.test.tsx
git commit -m "feat: 스탯 배지용 번개·시계·별 아이콘 컴포넌트 추가"
```

---

### Task 3: 카테고리 아이콘 (덤벨 · 연필 · 펼친책)

**Files:**
- Create: `frontend/src/components/icons/DumbbellIcon.tsx`
- Create: `frontend/src/components/icons/PencilIcon.tsx`
- Create: `frontend/src/components/icons/OpenBookIcon.tsx`
- Modify: `frontend/src/components/icons/icons.test.tsx`
- Modify: `frontend/src/components/KkumiCharacter.tsx:11`

**Interfaces:**
- Consumes: 없음 (독립 컴포넌트)
- Produces: `DumbbellIcon`, `PencilIcon`, `OpenBookIcon` — Task 2와 동일한 `IconProps` 시그니처. `CATEGORY_TINT`(이제 export됨, `Record<Category, {light: string; dark: string}>`) — Task 8(ActivitySelectPage)에서 사용.

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/src/components/icons/icons.test.tsx`의 기존 `describe` 블록 안, 마지막 `it` 다음에 추가:
```tsx
  it('renders DumbbellIcon as an svg', () => {
    const { container } = render(<DumbbellIcon color="#FF8A65" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3);
  });

  it('renders PencilIcon as an svg', () => {
    const { container } = render(<PencilIcon color="#64B5F6" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders OpenBookIcon as an svg', () => {
    const { container } = render(<OpenBookIcon color="#BA68C8" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('path').length).toBe(2);
  });
```
파일 상단 import에 추가:
```tsx
import { DumbbellIcon } from './DumbbellIcon';
import { PencilIcon } from './PencilIcon';
import { OpenBookIcon } from './OpenBookIcon';
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/components/icons/icons.test.tsx`
Expected: FAIL — `Failed to resolve import "./DumbbellIcon"`

- [ ] **Step 3: 세 아이콘 구현**

`frontend/src/components/icons/DumbbellIcon.tsx`:
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function DumbbellIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="1" y="9" width="4" height="6" rx="1.5" fill={color} />
      <rect x="19" y="9" width="4" height="6" rx="1.5" fill={color} />
      <rect x="6" y="11" width="12" height="2" rx="1" fill={color} />
    </svg>
  );
}
```

`frontend/src/components/icons/PencilIcon.tsx` (직선/도형만 사용해 회전시켜 항상 대칭이 되도록 구성):
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function PencilIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g transform="rotate(45 12 12)">
        <rect x="9" y="2" width="6" height="14" rx="1" fill={color} />
        <polygon points="9 16 15 16 12 21" fill={color} />
        <rect x="9" y="2" width="6" height="3" fill="#fff" opacity="0.5" />
      </g>
    </svg>
  );
}
```

`frontend/src/components/icons/OpenBookIcon.tsx` (좌우 페이지가 `x → 24-x`로 정확히 대칭):
```tsx
interface IconProps {
  className?: string;
  color?: string;
}

export function OpenBookIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M2 5 C2 5 6 4 12 6 L12 19 C6 17 2 18 2 18 Z" fill={color} />
      <path d="M22 5 C22 5 18 4 12 6 L12 19 C18 17 22 18 22 18 Z" fill={color} opacity="0.75" />
    </svg>
  );
}
```

- [ ] **Step 4: `KkumiCharacter.tsx`의 `CATEGORY_TINT` export**

`frontend/src/components/KkumiCharacter.tsx:11`, 다음:
```ts
const CATEGORY_TINT: Record<Category, Tint> = {
```
을 다음으로 교체:
```ts
export const CATEGORY_TINT: Record<Category, Tint> = {
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/components/icons/icons.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/icons/DumbbellIcon.tsx frontend/src/components/icons/PencilIcon.tsx frontend/src/components/icons/OpenBookIcon.tsx frontend/src/components/icons/icons.test.tsx frontend/src/components/KkumiCharacter.tsx
git commit -m "feat: 카테고리 아이콘(덤벨·연필·펼친책) 추가, CATEGORY_TINT export"
```

---

### Task 4: 공용 `useDailyTotals` 훅 + `computeCurrentStreak` 유틸

**Files:**
- Create: `frontend/src/hooks/useDailyTotals.ts`
- Create: `frontend/src/hooks/useDailyTotals.test.ts`
- Create: `frontend/src/utils/streak.ts`
- Create: `frontend/src/utils/streak.test.ts`
- Modify: `frontend/src/components/ActivityHeatmap.tsx`

**Interfaces:**
- Produces: `useDailyTotals(range: 'daily' | 'weekly'): { totalsByDate: Record<string, number>; error: string }`. `computeCurrentStreak(totalsByDate: Record<string, number>, today?: Date): number`.
- Consumes (Task 6, HomePage): 위 두 함수.

- [ ] **Step 1: `streak.ts`의 실패하는 테스트 작성**

`frontend/src/utils/streak.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeCurrentStreak } from './streak';

describe('computeCurrentStreak', () => {
  it('returns 0 when today has no verified time', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    expect(computeCurrentStreak({}, today)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    const totals = {
      '2026-07-15': 600,
      '2026-07-14': 900,
      '2026-07-13': 300,
      '2026-07-11': 500,
    };
    expect(computeCurrentStreak(totals, today)).toBe(3);
  });

  it('treats a zero-second day the same as a missing day', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    const totals = {
      '2026-07-15': 600,
      '2026-07-14': 0,
      '2026-07-13': 900,
    };
    expect(computeCurrentStreak(totals, today)).toBe(1);
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/utils/streak.test.ts`
Expected: FAIL — `Failed to resolve import "./streak"`

- [ ] **Step 3: `streak.ts` 구현**

`frontend/src/utils/streak.ts`:
```ts
export function computeCurrentStreak(totalsByDate: Record<string, number>, today: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(today);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    const seconds = totalsByDate[key] ?? 0;
    if (seconds <= 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/utils/streak.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: `useDailyTotals`의 실패하는 테스트 작성**

`frontend/src/hooks/useDailyTotals.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as historyApi from '../api/history';
import { useDailyTotals } from './useDailyTotals';

vi.mock('../api/history');

describe('useDailyTotals', () => {
  it('sums verifiedSeconds per date across categories', async () => {
    (historyApi.getHistory as any).mockResolvedValue([
      { date: '2026-07-14', category: 'STUDY', verifiedSeconds: 300 },
      { date: '2026-07-14', category: 'EXERCISE', verifiedSeconds: 200 },
      { date: '2026-07-13', category: 'READING', verifiedSeconds: 100 },
    ]);

    const { result } = renderHook(() => useDailyTotals('weekly'));

    await waitFor(() => {
      expect(result.current.totalsByDate).toEqual({
        '2026-07-14': 500,
        '2026-07-13': 100,
      });
    });
    expect(historyApi.getHistory).toHaveBeenCalledWith('weekly');
  });

  it('sets an error message when the request fails', async () => {
    (historyApi.getHistory as any).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDailyTotals('daily'));

    await waitFor(() => {
      expect(result.current.error).toBe('데이터를 불러오지 못했어요');
    });
  });
});
```

- [ ] **Step 6: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/hooks/useDailyTotals.test.ts`
Expected: FAIL — `Failed to resolve import "./useDailyTotals"`

- [ ] **Step 7: `useDailyTotals.ts` 구현**

`frontend/src/hooks/useDailyTotals.ts`:
```ts
import { useEffect, useState } from 'react';
import { getHistory } from '../api/history';

export function useDailyTotals(range: 'daily' | 'weekly') {
  const [totalsByDate, setTotalsByDate] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const entries = await getHistory(range);
        const totals: Record<string, number> = {};
        for (const e of entries) {
          totals[e.date] = (totals[e.date] ?? 0) + e.verifiedSeconds;
        }
        if (!cancelled) setTotalsByDate(totals);
      } catch {
        if (!cancelled) setError('데이터를 불러오지 못했어요');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  return { totalsByDate, error };
}
```

- [ ] **Step 8: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/hooks/useDailyTotals.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: `ActivityHeatmap.tsx`가 새 훅을 쓰도록 리팩터**

`frontend/src/components/ActivityHeatmap.tsx` 전체를 다음으로 교체 (기존 fetch 로직을 `useDailyTotals`로 대체, 렌더링 로직은 동일하게 유지):
```tsx
import { useDailyTotals } from '../hooks/useDailyTotals';

const DAYS = 28;

function colorForSeconds(seconds: number) {
  if (seconds <= 0) return 'bg-cream-dark';
  if (seconds < 900) return 'bg-mint-light';
  if (seconds < 1800) return 'bg-mint';
  return 'bg-mint-dark';
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function ActivityHeatmap() {
  const { totalsByDate, error } = useDailyTotals('weekly');

  if (error) return <p className="text-sm text-coral-dark">{error}</p>;

  const days = lastNDays(DAYS);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="bg-white rounded-card shadow-sm p-6 w-full">
      <p className="text-sm font-semibold text-ink-soft mb-4">최근 4주 활동</p>
      <div className="flex gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((date) => {
              const seconds = totalsByDate[date] ?? 0;
              return (
                <div
                  key={date}
                  title={`${date}: ${Math.round(seconds / 60)}분`}
                  className={`w-5 h-5 rounded ${colorForSeconds(seconds)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-4 text-xs text-ink-soft">
        <span>적음</span>
        <div className="w-3.5 h-3.5 rounded bg-cream-dark" />
        <div className="w-3.5 h-3.5 rounded bg-mint-light" />
        <div className="w-3.5 h-3.5 rounded bg-mint" />
        <div className="w-3.5 h-3.5 rounded bg-mint-dark" />
        <span>많음</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: 전체 프론트 테스트 실행해 리팩터로 아무것도 안 깨졌는지 확인**

Run: `cd frontend && npx vitest run`
Expected: 기존 스위트 전부 PASS (HomePage가 `ActivityHeatmap`을 렌더하므로 간접 확인됨)

- [ ] **Step 11: Commit**

```bash
git add frontend/src/hooks/useDailyTotals.ts frontend/src/hooks/useDailyTotals.test.ts frontend/src/utils/streak.ts frontend/src/utils/streak.test.ts frontend/src/components/ActivityHeatmap.tsx
git commit -m "refactor: 날짜별 합계 로직을 useDailyTotals 훅으로 추출, 스트릭 계산 유틸 추가"
```

---

### Task 5: `StatBadge` 컴포넌트

**Files:**
- Create: `frontend/src/components/StatBadge.tsx`
- Create: `frontend/src/components/StatBadge.test.tsx`

**Interfaces:**
- Consumes: `BoltIcon`/`ClockIcon`/`StarIcon`(Task 2) — 아이콘은 `icon: ReactNode` prop으로 부모가 만들어 전달.
- Produces: `StatBadge` — `(props: { icon: ReactNode; value: string; label: string; tint: 'coral' | 'mint' | 'honey' }) => JSX.Element`. Task 6(HomePage)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/StatBadge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatBadge from './StatBadge';
import { BoltIcon } from './icons/BoltIcon';

describe('StatBadge', () => {
  it('renders the value and label', () => {
    render(<StatBadge icon={<BoltIcon />} value="3일" label="연속" tint="coral" />);
    expect(screen.getByText('3일')).toBeInTheDocument();
    expect(screen.getByText('연속')).toBeInTheDocument();
  });

  it('renders the passed icon', () => {
    const { container } = render(<StatBadge icon={<BoltIcon />} value="3일" label="연속" tint="coral" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/components/StatBadge.test.tsx`
Expected: FAIL — `Failed to resolve import "./StatBadge"`

- [ ] **Step 3: `StatBadge.tsx` 구현**

`frontend/src/components/StatBadge.tsx`:
```tsx
import { ReactNode } from 'react';

interface StatBadgeProps {
  icon: ReactNode;
  value: string;
  label: string;
  tint: 'coral' | 'mint' | 'honey';
}

const SHADOW_BY_TINT: Record<StatBadgeProps['tint'], string> = {
  coral: 'shadow-[0_4px_14px_-6px_rgba(232,93,130,0.35)]',
  mint: 'shadow-[0_4px_14px_-6px_rgba(63,191,153,0.35)]',
  honey: 'shadow-[0_4px_14px_-6px_rgba(201,138,0,0.35)]',
};

const TEXT_BY_TINT: Record<StatBadgeProps['tint'], string> = {
  coral: 'text-coral-dark',
  mint: 'text-mint-dark',
  honey: 'text-honey-dark',
};

export default function StatBadge({ icon, value, label, tint }: StatBadgeProps) {
  return (
    <div
      className={`flex-1 rounded-2xl bg-white py-3 px-1.5 text-center flex flex-col items-center gap-1 ${SHADOW_BY_TINT[tint]}`}
    >
      <div className={TEXT_BY_TINT[tint]}>{icon}</div>
      <span className={`text-base font-display ${TEXT_BY_TINT[tint]}`}>{value}</span>
      <span className="text-[9.5px] text-ink-soft">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/components/StatBadge.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatBadge.tsx frontend/src/components/StatBadge.test.tsx
git commit -m "feat: StatBadge 컴포넌트 추가"
```

---

### Task 6: HomePage — 스탯 배지 + 원형 LV 링

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `useDailyTotals`(Task 4), `computeCurrentStreak`(Task 4), `StatBadge`(Task 5), `BoltIcon`/`ClockIcon`/`StarIcon`(Task 2).

- [ ] **Step 1: 기존 테스트를 새 마크업 기준으로 수정 (먼저 테스트, 실패 확인 후 구현)**

`frontend/src/pages/HomePage.test.tsx` 전체를 다음으로 교체:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current stage, category, and computed stats', async () => {
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
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText('LV.1')).toBeInTheDocument();
      expect(screen.getByText('1일')).toBeInTheDocument(); // 오늘 기록이 있으므로 연속 1일
      expect(screen.getByText('1h')).toBeInTheDocument(); // 3700초 -> 1시간
      expect(screen.getByText('0개')).toBeInTheDocument(); // 뱃지는 아직 실데이터 없음
    });
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/pages/HomePage.test.tsx`
Expected: FAIL — `LV.1`, `1일`, `1h`, `0개` 텍스트를 찾지 못함

- [ ] **Step 3: `HomePage.tsx` 구현**

`frontend/src/pages/HomePage.tsx` 전체를 다음으로 교체:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';
import Layout from '../components/Layout';
import { KkumiCharacter } from '../components/KkumiCharacter';
import ActivityHeatmap from '../components/ActivityHeatmap';
import StatBadge from '../components/StatBadge';
import { BoltIcon } from '../components/icons/BoltIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import { StarIcon } from '../components/icons/StarIcon';
import { useDailyTotals } from '../hooks/useDailyTotals';
import { computeCurrentStreak } from '../utils/streak';

export default function HomePage() {
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
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

  return (
    <Layout>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
        <div className="bg-white rounded-card shadow-sm p-8 text-center space-y-3">
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <circle cx="50" cy="50" r="47" fill="none" stroke="#ffd7e1" strokeWidth="4" />
            </svg>
            <div className="absolute inset-3">
              <KkumiCharacter stage={growth.stage} category={growth.dominantCategory} />
            </div>
            <span className="absolute bottom-0 right-0 bg-ink text-white text-xs font-display px-2 py-0.5 rounded-full">
              LV.{growth.stage}
            </span>
          </div>
          <p className="text-lg font-display text-coral-dark">{growth.dominantCategory} 꾸미</p>
          <div className="flex gap-2 pt-1">
            <StatBadge icon={<BoltIcon color="#e85d82" />} value={`${streak}일`} label="연속" tint="coral" />
            <StatBadge icon={<ClockIcon color="#3fbf99" />} value={`${accumulatedHours}h`} label="누적" tint="mint" />
            <StatBadge icon={<StarIcon color="#c98a00" />} value="0개" label="뱃지" tint="honey" />
          </div>
          <button
            onClick={() => navigate('/activities')}
            className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors mt-2"
          >
            타이머 시작
          </button>
        </div>

        <ActivityHeatmap />
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/HomePage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/HomePage.test.tsx
git commit -m "feat: 홈 화면에 원형 LV 링과 스탯 배지(연속/누적/뱃지) 적용"
```

---

### Task 7: LoginPage — 캐릭터 도입 + 포인트 폰트

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `KkumiCharacter`(기존, stage=0으로 알 단계 렌더).

- [ ] **Step 1: 기존 테스트가 통과하는지 먼저 확인 (베이스라인)**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: PASS (변경 전이므로 통과해야 정상)

- [ ] **Step 2: `LoginPage.tsx` 구현**

`frontend/src/pages/LoginPage.tsx`의 return 블록을 다음으로 교체 (상단 import에 `KkumiCharacter` 추가):
```tsx
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { KkumiCharacter } from '../components/KkumiCharacter';

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
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-mint-light opacity-60" />
      <div className="absolute -bottom-14 -right-14 w-56 h-56 rounded-full bg-honey/30" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white rounded-card shadow-sm p-8 space-y-4"
      >
        <div className="text-center mb-2">
          <div className="w-20 h-20 mx-auto">
            <KkumiCharacter stage={0} category="ETC" />
          </div>
          <h1 className="text-2xl font-display text-coral-dark mt-2">그로우미</h1>
          <p className="text-sm text-ink-soft mt-1">몰입한 시간만큼, 꾸미가 자라요</p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-soft mb-1">
            이메일
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-soft mb-1">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors"
        >
          로그인
        </button>
        {error && <p className="text-sm text-coral-dark text-center">{error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 테스트 실행해 여전히 통과하는지 확인**

Run: `cd frontend && npx vitest run src/pages/LoginPage.test.tsx`
Expected: PASS (1 test) — 기능 동작은 그대로이므로 회귀 없어야 함

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: 로그인 화면에 알 단계 캐릭터·포인트 폰트·배경 장식 적용"
```

---

### Task 8: ActivitySelectPage — 카테고리 아이콘

**Files:**
- Modify: `frontend/src/pages/ActivitySelectPage.tsx`

**Interfaces:**
- Consumes: `CATEGORY_TINT`(Task 3, from `KkumiCharacter.tsx`), `DumbbellIcon`/`PencilIcon`/`OpenBookIcon`(Task 3)/`StarIcon`(Task 2).

- [ ] **Step 1: 기존 테스트가 통과하는지 먼저 확인 (베이스라인)**

Run: `cd frontend && npx vitest run src/pages/ActivitySelectPage.test.tsx`
Expected: PASS

- [ ] **Step 2: `ActivitySelectPage.tsx` 구현**

`frontend/src/pages/ActivitySelectPage.tsx` 전체를 다음으로 교체:
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, listActivities, createActivity } from '../api/activities';
import Layout from '../components/Layout';
import { CATEGORY_TINT } from '../components/KkumiCharacter';
import { DumbbellIcon } from '../components/icons/DumbbellIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { OpenBookIcon } from '../components/icons/OpenBookIcon';
import { StarIcon } from '../components/icons/StarIcon';

const CATEGORIES: Activity['category'][] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const CATEGORY_LABEL: Record<Activity['category'], string> = {
  EXERCISE: '운동',
  STUDY: '학업',
  READING: '독서',
  ETC: '기타',
};
const CATEGORY_ICON: Record<Activity['category'], typeof DumbbellIcon> = {
  EXERCISE: DumbbellIcon,
  STUDY: PencilIcon,
  READING: OpenBookIcon,
  ETC: StarIcon,
};

export default function ActivitySelectPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Activity['category']>('ETC');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchActivities() {
      try {
        const data = await listActivities();
        setActivities(data);
      } catch {
        setError('활동 목록을 불러오지 못했어요');
      }
    }
    fetchActivities();
  }, []);

  async function handleCreate() {
    try {
      const created = await createActivity(name, category);
      setActivities((prev) => [...prev, created]);
      setName('');
    } catch {
      setError('활동을 만들지 못했어요');
    }
  }

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-display text-coral-dark text-center">어떤 활동을 할까요?</h1>

        <ul className="space-y-2">
          {activities.map((a) => {
            const Icon = CATEGORY_ICON[a.category];
            const tint = CATEGORY_TINT[a.category];
            return (
              <li key={a.id}>
                <button
                  onClick={() => navigate(`/timer/${a.id}`)}
                  className="w-full flex items-center gap-3 bg-white rounded-card shadow-sm px-5 py-4 hover:shadow-md transition-shadow text-left"
                >
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                    style={{ backgroundColor: tint.light }}
                  >
                    <Icon color={tint.dark} className="w-5 h-5" />
                  </span>
                  <span className="font-medium text-ink flex-1">{a.name}</span>
                  <span className="text-xs font-semibold text-mint-dark bg-mint-light px-2 py-1 rounded-full">
                    {CATEGORY_LABEL[a.category]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="bg-white rounded-card shadow-sm p-6 space-y-3">
          <p className="text-sm font-semibold text-ink-soft">새로운 활동 추가하기</p>
          <div>
            <label htmlFor="activity-name" className="sr-only">
              활동 이름
            </label>
            <input
              id="activity-name"
              placeholder="예: 알고리즘 스터디"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Activity['category'])}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors"
          >
            활동 만들기
          </button>
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: 테스트 실행해 여전히 통과하는지 확인**

Run: `cd frontend && npx vitest run src/pages/ActivitySelectPage.test.tsx`
Expected: PASS (2 tests) — 버튼의 접근 가능한 이름은 아이콘(aria-hidden svg)에 영향받지 않음

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ActivitySelectPage.tsx
git commit -m "feat: 활동 선택 화면에 카테고리 아이콘 배지 적용"
```

---

### Task 9: TimerPage — 원형 링 시각화

**Files:**
- Modify: `frontend/src/pages/TimerPage.tsx`
- Create: `frontend/src/pages/TimerPage.test.tsx`

**Interfaces:**
- Consumes: `useFocusTimer`(기존, `{ elapsedSeconds, isPaused, error, end }`) — Task에서 mock.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/pages/TimerPage.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useFocusTimer } from '../hooks/useFocusTimer';
import TimerPage from './TimerPage';

vi.mock('../hooks/useFocusTimer');

function renderTimerPage() {
  return render(
    <MemoryRouter initialEntries={['/timer/activity-1']}>
      <Routes>
        <Route path="/timer/:activityId" element={<TimerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TimerPage', () => {
  it('shows a coral progress ring while running', () => {
    vi.mocked(useFocusTimer).mockReturnValue({
      elapsedSeconds: 12,
      isPaused: false,
      error: null,
      end: vi.fn(),
    });

    const { container } = renderTimerPage();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#ff7a9c');
  });

  it('switches the ring to honey when paused', () => {
    vi.mocked(useFocusTimer).mockReturnValue({
      elapsedSeconds: 12,
      isPaused: true,
      error: null,
      end: vi.fn(),
    });

    const { container } = renderTimerPage();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#ffd166');
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd frontend && npx vitest run src/pages/TimerPage.test.tsx`
Expected: FAIL — 현재 `TimerPage`는 `<circle>`을 렌더하지 않음

- [ ] **Step 3: `TimerPage.tsx` 구현**

`frontend/src/pages/TimerPage.tsx` 전체를 다음으로 교체:
```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFocusTimer } from '../hooks/useFocusTimer';
import Layout from '../components/Layout';

export default function TimerPage() {
  const { activityId } = useParams();
  const { elapsedSeconds, isPaused, error: timerError, end } = useFocusTimer(activityId!);
  const [result, setResult] = useState<number | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const navigate = useNavigate();
  const error = endError ?? timerError;

  async function handleEnd() {
    setEndError(null);
    try {
      const finalSeconds = await end();
      setResult(finalSeconds);
    } catch {
      setEndError('세션 종료에 실패했습니다. 다시 시도해주세요.');
    }
  }

  if (result !== null) {
    return (
      <Layout>
        <div className="w-full max-w-sm bg-white rounded-card shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <p className="text-ink">
            이번 세션 인증 시간: <span className="font-display text-coral-dark">{result}초</span>
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors"
          >
            홈으로
          </button>
        </div>
      </Layout>
    );
  }

  const ringColor = isPaused ? '#ffd166' : '#ff7a9c';

  return (
    <Layout>
      <div className="w-full max-w-sm bg-white rounded-card shadow-sm p-8 text-center space-y-4">
        <span
          className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${
            isPaused ? 'bg-honey/30 text-ink-soft' : 'bg-mint-light text-mint-dark'
          }`}
        >
          {isPaused ? '일시정지됨' : '진행 중'}
        </span>
        <div className="relative w-48 h-48 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="44" fill="none" stroke={ringColor} strokeWidth="6" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-4xl font-display text-coral-dark tabular-nums">{elapsedSeconds}초</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-coral-dark">
            {error}
          </p>
        )}
        <button
          onClick={handleEnd}
          className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors"
        >
          종료
        </button>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd frontend && npx vitest run src/pages/TimerPage.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TimerPage.tsx frontend/src/pages/TimerPage.test.tsx
git commit -m "feat: 타이머 화면에 원형 진행 링 시각화 추가"
```

---

### Task 10: HistoryPage — 카테고리 아이콘

**Files:**
- Modify: `frontend/src/pages/HistoryPage.tsx`

**Interfaces:**
- Consumes: `CATEGORY_TINT`(Task 3), `DumbbellIcon`/`PencilIcon`/`OpenBookIcon`(Task 3)/`StarIcon`(Task 2).

- [ ] **Step 1: 기존 테스트가 통과하는지 먼저 확인 (베이스라인)**

Run: `cd frontend && npx vitest run src/pages/HistoryPage.test.tsx`
Expected: PASS

- [ ] **Step 2: `HistoryPage.tsx` 구현**

`frontend/src/pages/HistoryPage.tsx` 전체를 다음으로 교체:
```tsx
import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';
import Layout from '../components/Layout';
import { CATEGORY_TINT } from '../components/KkumiCharacter';
import { DumbbellIcon } from '../components/icons/DumbbellIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { OpenBookIcon } from '../components/icons/OpenBookIcon';
import { StarIcon } from '../components/icons/StarIcon';

const CATEGORY_LABEL: Record<string, string> = {
  EXERCISE: '운동',
  STUDY: '학업',
  READING: '독서',
  ETC: '기타',
};
const CATEGORY_ICON: Record<string, typeof DumbbellIcon> = {
  EXERCISE: DumbbellIcon,
  STUDY: PencilIcon,
  READING: OpenBookIcon,
  ETC: StarIcon,
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [range, setRange] = useState<'daily' | 'weekly'>('daily');
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getHistory(range);
        setEntries(data);
      } catch {
        setError('히스토리를 불러오지 못했어요');
      }
    }
    fetchHistory();
  }, [range]);

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display text-coral-dark">히스토리</h1>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as 'daily' | 'weekly')}
            className="rounded-xl border border-cream-dark px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40"
          >
            <option value="daily">일간</option>
            <option value="weekly">주간</option>
          </select>
        </div>

        {entries.length === 0 && <p className="text-sm text-ink-soft text-center py-6">아직 기록이 없어요</p>}

        <ul className="space-y-2">
          {entries.map((e, i) => {
            const Icon = CATEGORY_ICON[e.category] ?? StarIcon;
            const tint = CATEGORY_TINT[e.category as keyof typeof CATEGORY_TINT] ?? CATEGORY_TINT.ETC;
            return (
              <li key={i} className="flex items-center gap-3 bg-white rounded-card shadow-sm px-5 py-3">
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: tint.light }}
                >
                  <Icon color={tint.dark} className="w-4 h-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm text-ink-soft">{e.date}</p>
                  <span className="text-xs font-semibold text-mint-dark bg-mint-light px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </span>
                </div>
                <p className="font-display text-lg text-coral-dark">{e.verifiedSeconds}초</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: 테스트 실행해 여전히 통과하는지 확인**

Run: `cd frontend && npx vitest run src/pages/HistoryPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/HistoryPage.tsx
git commit -m "feat: 히스토리 목록에 카테고리 아이콘 배지 적용"
```

---

### Task 11: Layout 헤더 폰트 + 전체 회귀 + 수동 확인

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: 헤더 로고에 `font-display` 적용**

`frontend/src/components/Layout.tsx:17-19`, 다음:
```tsx
        <Link to="/" className="text-lg font-bold text-coral-dark">
          🌱 그로우미
        </Link>
```
을 다음으로 교체 (이모지 제거, 폰트만으로 표현):
```tsx
        <Link to="/" className="text-lg font-display text-coral-dark">
          그로우미
        </Link>
```

- [ ] **Step 2: 전체 테스트 스위트 실행**

Run: `cd frontend && npx vitest run`
Expected: 모든 테스트 PASS (기존 + 이번 태스크들에서 추가한 것 전부)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: 헤더 로고 이모지를 제거하고 font-display로 표현"
```

- [ ] **Step 4: 개발 서버로 전 페이지 수동 확인**

Run: `cd frontend && npm run dev` (백그라운드 실행 또는 `/run` 스킬 사용)
브라우저에서 로그인 → 홈 → 활동선택 → 타이머 시작 → 히스토리 순서로 이동하며 다음을 눈으로 확인:
- 이모지가 하나도 안 보이는지 (커스텀 아이콘으로 대체됐는지)
- 제목/버튼/숫자에 Do Hyeon 폰트가 적용됐는지
- 홈 화면 캐릭터 주위 링 + LV 뱃지 + 3개 스탯 배지가 잘 보이는지
- 타이머 화면 원형 링이 진행/일시정지 상태에 따라 색이 바뀌는지 (탭을 백그라운드로 보내면 일시정지됨)

Expected: 위 항목 전부 육안 확인. 문제 발견 시 해당 태스크로 돌아가 수정.

- [ ] **Step 5: 개발 서버 종료**

Run: 서버 프로세스 종료 (Ctrl+C 또는 background job kill)
