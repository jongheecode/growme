# 히스토리 화면 (Sub-project 6) 설계

- 작성일: 2026-07-20
- 브레인스토밍 대화형 질문 단계는 사용자의 명시적 지시(`/loop ... 아무것도 물어보지 말고 진행해`, [[feedback_unattended_execution]])에 따라 생략하고, 아래 결정은 기존 확정 설계(메모리 `project_v2_app_pivot.md`)와 코드베이스 현황을 근거로 스스로 판단했다.

## 배경 / 현황

- `HistoryScreen.tsx`는 현재 "히스토리 화면 준비 중입니다" 플레이스홀더 텍스트뿐이고, 어떤 API도 호출하지 않는다.
- 레거시 `GET /api/history`(`backend/src/routes/history.ts`)는 V1 시절 `Activity`/`Session.activityId` 기반 카테고리별 시간 집계 엔드포인트다. 모바일 어디에서도 호출하지 않는 고아 엔드포인트이며, 자체 테스트(`history.test.ts`)만 존재한다. 현재 앱의 핵심 개념(목표→태스크→XP)과 무관하므로 그대로 둔다 — 수정도, 재사용도 하지 않는다.
- 서브프로젝트 2에서 확정된 원칙: 성장/XP는 오직 태스크 완료로만 발생한다. 서브프로젝트 5에서 만든 `Session.taskId`/`verifiedSeconds`는 XP에 영향 없는 순수 "집중 시간 기록"이며, 서브프로젝트 4의 문서에 "히스토리 화면에서 보여줄 것"이라고 명시돼 있다.

## 핵심 결정

1. **히스토리의 단위는 "완료/실패한 태스크"다.** `Task.status`가 `PENDING`이 아닌(=COMPLETED 또는 FAILED) 태스크들을 최신순으로 나열한다. PENDING 태스크는 히스토리가 아니라 아직 진행 중인 항목이므로 제외한다.
2. **정렬 기준은 "발생 시점"(`occurredAt`)이며, COMPLETED는 `completedAt`, FAILED는 `dueAt`(기한이 지나 자동 실패 처리된 시점)을 사용한다.** FAILED 태스크는 `completedAt`이 null이기 때문.
3. **각 항목에 해당 태스크에 연결된 `Session`들의 `verifiedSeconds` 합계(`focusSeconds`)를 함께 반환한다.** 타이머를 쓰지 않은 태스크는 0이 된다 — 정상이며 에러 상태가 아니다.
4. **새 엔드포인트 `GET /api/history/tasks`를 기존 `history.ts` 라우터(이미 `/api/history`에 마운트됨)에 추가한다.** 레거시 `GET /api/history`(`/`)는 그대로 두고 건드리지 않는다. 페이지네이션은 만들지 않는다 — 개인 프로젝트 규모에서 과설계.
5. **XP 합계나 완료율 같은 요약 통계는 서버에서 계산하지 않는다.** 모바일 화면이 받은 리스트로 필요하면 직접 reduce한다(기존 `TaskSheet`의 `done`/`total` 카운트와 동일 패턴) — 서버 계약을 단순하게 유지.
6. **모바일 `HistoryScreen`은 `HomeScreen`과 동일한 로딩/에러/재시도 패턴**(마운트 시 fetch, 실패 시 에러 메시지 + 재시도 버튼)을 따른다. 빈 히스토리(아직 완료/실패한 태스크가 없음)는 별도 안내 문구로 표시한다.
7. **리스트 항목 표시 내용:** 제목, 카테고리, 난이도, 상태(완료됨/실패), 발생 날짜, XP(완료 시 `+N XP`, 실패 시 표시 안 함), 집중 시간(0보다 크면 `mm:ss`, 0이면 표시 안 함). 시각 디자인은 플레이스홀더([[feedback_design_workflow]] — 사용자가 나중에 별도로 완성).

## API 계약

### `GET /api/history/tasks`

- 인증 필요 (`requireAuth`).
- 응답: `HistoryEntry[]`, `occurredAt` 내림차순(최신 먼저).

```ts
interface HistoryEntry {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  status: 'COMPLETED' | 'FAILED';
  xpValue: number;
  occurredAt: string; // ISO — COMPLETED면 completedAt, FAILED면 dueAt
  focusSeconds: number; // 연결된 Session.verifiedSeconds 합계, 없으면 0
}
```

- 구현: `prisma.task.findMany({ where: { userId, status: { not: 'PENDING' } }, include: { sessions: true } })` 후 매핑 + 정렬. 500은 기존 라우트들과 동일하게 catch-all.

## 모바일 구현

- `mobile/src/api/history.ts` (신규): `HistoryEntry` 타입 + `getTaskHistory(): Promise<HistoryEntry[]>`, 실패 시 기존 패턴과 동일하게 한국어 에러 메시지 throw.
- `mobile/src/screens/HistoryScreen.tsx` (재작성): 마운트 시 `getTaskHistory()` 호출 → 로딩 중 텍스트 → 성공 시 리스트(빈 배열이면 "아직 기록이 없어요" 안내) → 실패 시 에러 + 재시도 버튼(`HomeScreen`의 `home-error`/`home-retry` 패턴과 동일한 testID 네이밍 컨벤션: `history-error`/`history-retry`, 리스트는 `history-list`, 각 행은 `history-row-{id}`).

## 테스트 전략 (TDD)

- 백엔드: 빈 히스토리(200 `[]`), COMPLETED 태스크 1개(필드 정확성 + occurredAt=completedAt), FAILED 태스크 1개(occurredAt=dueAt, xpValue는 응답에 포함되지만 UI에서 안 씀), 여러 Session의 verifiedSeconds 합산, PENDING 태스크 제외, 최신순 정렬(occurredAt 기준), 인증 없으면 401 — 기존 `tasks.test.ts`/`sessions.test.ts`의 `setupUser`/`setupUserAndTask` 헬퍼 재사용.
- 모바일: 로딩→리스트 렌더링, 빈 상태 문구, 에러+재시도, 완료 항목 텍스트(XP 포함), 실패 항목 텍스트(XP 없음), 집중시간 있는/없는 항목 표시 차이 — `HomeScreen.test.tsx`의 mock 패턴을 그대로 따른다.
