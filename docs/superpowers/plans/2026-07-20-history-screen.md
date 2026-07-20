# 히스토리 화면 구현 계획 (Sub-project 6)

스펙: `docs/superpowers/specs/2026-07-20-history-screen-design.md`. worktree 없이 master에 직접 진행(서브프로젝트 4-5와 동일 패턴, [[feedback_unattended_execution]]).

## Task 1 — 백엔드: `GET /api/history/tasks` 테스트 (Red)

`backend/src/routes/history.test.ts`에 새 `describe('GET /api/history/tasks', ...)` 블록 추가:
- 완료/실패 태스크가 없으면 `[]` 반환
- COMPLETED 태스크 1개: `status`, `occurredAt === completedAt`, `xpValue`, `focusSeconds === 0`(세션 없음)
- FAILED 태스크 1개: `occurredAt === dueAt`
- 태스크에 연결된 Session 2개(`verifiedSeconds` 100, 250) → `focusSeconds === 350`
- PENDING 태스크는 응답에 없음
- 여러 항목이 `occurredAt` 내림차순으로 정렬됨
- 인증 헤더 없으면 401

기존 `setupUser`/직접 `prisma.task.create` 패턴 재사용. 실행해서 실패(라우트 없음 → 404) 확인.

## Task 2 — 백엔드: 라우트 구현 (Green)

`backend/src/routes/history.ts`에 `router.get('/tasks', requireAuth, ...)` 추가 (기존 `/` 핸들러는 그대로 둠):

```ts
router.get('/tasks', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId!, status: { not: 'PENDING' } },
      include: { sessions: true },
    });

    const entries = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      difficulty: t.difficulty,
      status: t.status as 'COMPLETED' | 'FAILED',
      xpValue: t.xpValue,
      occurredAt: (t.status === 'COMPLETED' ? t.completedAt! : t.dueAt).toISOString(),
      focusSeconds: t.sessions.reduce((sum, s) => sum + s.verifiedSeconds, 0),
    }));

    entries.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

    res.json(entries);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});
```

주의: express 라우트 순서 — `/tasks`는 정적 경로라 기존 `/`(GET only, 쿼리 파라미터 기반)와 충돌 없음. `router.get('/', ...)`이 먼저 정의돼 있어도 `/tasks`는 별도 경로라 순서 무관하지만, 명확성을 위해 `/` 핸들러 뒤에 추가.

실행: `cd backend && npx vitest run src/routes/history.test.ts` → 통과 확인. 이어서 `npm test` 전체 + `npx tsc --noEmit`.

커밋: "feat: GET /api/history/tasks 태스크 이력 엔드포인트 추가"

## Task 3 — 모바일: API 클라이언트

`mobile/src/api/history.ts` (신규):

```ts
import { apiFetch } from './client';
import { Category, Difficulty } from './tasks';

export interface HistoryEntry {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  status: 'COMPLETED' | 'FAILED';
  xpValue: number;
  occurredAt: string;
  focusSeconds: number;
}

export async function getTaskHistory(): Promise<HistoryEntry[]> {
  const res = await apiFetch('/api/history/tasks');
  if (!res.ok) throw new Error('히스토리를 불러오지 못했어요');
  return res.json();
}
```

`tsc --noEmit` 확인. 커밋: "feat: 모바일 히스토리 API 클라이언트 추가"

## Task 4 — 모바일: `HistoryScreen` 테스트 (Red)

`mobile/src/screens/HistoryScreen.test.tsx` (신규):
- 마운트 시 `getTaskHistory` 호출, 로딩 후 리스트 렌더링
- 빈 배열 → "아직 기록이 없어요" 문구
- COMPLETED 항목: 제목 + `+10XP` 텍스트 표시
- FAILED 항목: 제목 표시, XP 텍스트는 없음
- `focusSeconds > 0`인 항목: `mm:ss` 텍스트 표시 (예: 125초 → `02:05`)
- `focusSeconds === 0`인 항목: 시간 텍스트 없음
- 로드 실패 → `history-error` 표시 + `history-retry` 버튼, 누르면 재조회

`jest.mock('../api/history')` 사용, `HomeScreen.test.tsx`의 mock/waitFor 패턴을 따름. 실행해서 실패(컴포넌트 없음) 확인.

## Task 5 — 모바일: `HistoryScreen` 구현 (Green)

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { HistoryEntry, getTaskHistory } from '../api/history';

function formatFocus(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await getTaskHistory();
      setEntries(result);
    } catch {
      setError('히스토리를 불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="history-error">{error}</Text>
        <TouchableOpacity testID="history-retry" onPress={load}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!entries) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>불러오는 중...</Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>아직 기록이 없어요</Text>
      </View>
    );
  }

  return (
    <ScrollView testID="history-list" style={{ flex: 1 }}>
      {entries.map((e) => (
        <View key={e.id} testID={`history-row-${e.id}`} style={{ padding: 12 }}>
          <Text>{e.title}</Text>
          <Text>{`${e.category} · ${e.difficulty} · ${e.status === 'COMPLETED' ? '완료됨' : '실패'}`}</Text>
          {e.status === 'COMPLETED' ? <Text>{`+${e.xpValue}XP`}</Text> : null}
          {e.focusSeconds > 0 ? <Text>{formatFocus(e.focusSeconds)}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
```

실행: `cd mobile && npx jest src/screens/HistoryScreen.test.tsx` → 통과. 이어서 `npx jest` 전체 + `npx tsc --noEmit`.

커밋: "feat: 히스토리 화면에 태스크 이력 표시 연결"

## Task 6 — 최종 회귀 + 메모리 업데이트

- `cd backend && npm test && npx tsc --noEmit`
- `cd mobile && npx jest && npx tsc --noEmit`
- 모두 그린이면 memory (`project_v2_app_pivot.md`, `MEMORY.md`) 업데이트: 서브프로젝트 6 완료 기록, 다음은 7(소셜) 안내.
