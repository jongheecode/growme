# 미션 실행 화면 + 타이머 (Sub-project 5 of 8) — Design Spec

## 배경

서브프로젝트 1-4가 완료되어 RN 앱에 로그인/온보딩/목표 설정/할일 CRUD/XP 성장/AI 할일 추천/완료·실패 리액션까지 갖춰져 있다. 이번 서브프로젝트는 [[project_v2_app_pivot]] 원 기획의 "타이머는 부가 기능이 아니라 미션 실행 화면 안에 있다"는 결정을 구현한다.

백엔드에는 V1 시절 만들어진 `Activity`/`Session` 하트비트 검증 타이머(부정 방지: 30초마다 heartbeat, 마지막 heartbeat로부터 5분 이상 끊기면 그 이후 시간은 카운트 안 함, `staleSessionJob`이 방치된 세션을 자동 종료)가 그대로 남아있다 — 서브프로젝트 2에서 성장(XP) 연동만 제거되고 세션 자체의 시간 검증 로직은 이번에 재사용하도록 의도적으로 보존됐다([[project_v2_app_pivot]] 참고). 다만 `Session.activityId`는 현재 `Activity`에만 연결되고 `Task`에는 연결되지 않는다.

**본 문서 작성 시 브레인스토밍의 대화형 질문 단계는 생략했다** — 사용자가 이 세션에서 "개인 프로젝트니까 묻지 말고 끝까지 진행해"라고 명시적으로 지시했기 때문이다([[feedback_unattended_execution]]). 아래 설계는 서브프로젝트 1-4에서 이미 확정된 패턴(hybrid task creation, XP는 오직 완료로만 획득, Modal 기반 화면 전환, `Animated` 내장 API 사용 등)을 따라 합리적으로 결정한 것이며, 사용자가 스펙을 검토하면서 언제든 방향을 바꿀 수 있다.

## 목표

할일 목록에서 태스크 하나를 탭하면 그 태스크 전용 "미션 실행" 화면이 열리고, 거기서 타이머를 시작/중지하며 집중 시간을 재고, 완료 처리도 그 화면에서 할 수 있게 한다. 타이머로 잰 시간은 XP나 성장에는 전혀 영향을 주지 않는다(서브프로젝트 2에서 확정된 "성장은 오직 완료로만" 원칙 유지) — 순수하게 사용자 본인이 집중한 시간을 기록/확인하기 위한 것이며, 이 기록은 서브프로젝트 6(히스토리)에서 보여줄 데이터의 기반이 된다.

## 범위 밖 (Out of scope)

- 앱이 백그라운드/종료된 상태에서도 타이머가 계속 흐르는 것(진짜 백그라운드 타이머, 푸시 알림 등) — 원 기획대로 "앱이 열려있는 동안" 재는 타이머로 한정.
- 세션 기록을 실제로 보여주는 히스토리 화면 — 서브프로젝트 6.
- 타이머 도중 앱이 꺼지거나 강제 종료됐을 때의 정교한 복구/재개 — `staleSessionJob`이 5분 뒤 자동 종료하는 기존 안전장치로 충분하다고 보고, 재개 로직은 만들지 않는다.
- 레거시 `Activity` 기반 세션(`/api/activities`, 기존 `sessions.test.ts`의 activityId 경로) — 그대로 유지, 건드리지 않는다.

## 아키텍처

### 데이터 모델 변경 (Prisma)

`Session.activityId`를 nullable로 바꾸고, `Session.taskId`(nullable, `Task`로의 FK)를 추가한다. 정확히 하나만 채워지도록(둘 다 null이거나 둘 다 채워지는 것은 금지) 애플리케이션 레벨에서 검증한다 — DB 레벨 체크 제약은 기존 스키마 관례상 사용하지 않으므로 라우트 핸들러에서 검증.

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

### 백엔드

- `POST /api/sessions/start`: `{ activityId }`(기존, 변경 없음) 또는 `{ taskId }`(신규) 중 정확히 하나만 받는다. `taskId` 경로는 그 태스크가 호출자 소유이고 `status === 'PENDING'`인지 확인(완료/실패한 태스크는 타이머 시작 불가 — 409). 둘 다 없거나 둘 다 있으면 400.
- `POST /api/sessions/:id/heartbeat`, `POST /api/sessions/:id/end`: 변경 없음 — 이미 세션 id 기준으로만 동작해서 activity/task 어느 쪽이든 그대로 동작한다.
- `staleSessionJob`: 변경 없음 — `taskId`/`activityId` 구분 없이 `endedAt: null && lastHeartbeatAt < threshold`만 본다.

### 모바일

**새 API 클라이언트** `mobile/src/api/sessions.ts`:
```ts
export async function startTaskSession(taskId: string): Promise<{ id: string; startedAt: string }>
export async function sendHeartbeat(sessionId: string): Promise<{ verifiedSeconds: number }>
export async function endSession(sessionId: string): Promise<{ verifiedSeconds: number }>
```

**새 컴포넌트** `mobile/src/components/MissionModal.tsx` — `ReactionModal`/`KkumiInfoModal`과 같은 패턴(react-navigation 스택을 새로 만들지 않고, `HomeScreen`이 조건부로 렌더링하는 풀스크린 `Modal`). React Navigation 스택을 새로 도입하지 않는 이유: 기존 "화면 전환"이 전부 이 Modal 패턴이라(TaskSheet도 bottom-sheet-morph, KkumiInfoModal/ReactionModal도 Modal), 일관성을 위해 따른다.

Props: `{ task: Task | null; onClose: () => void; onComplete: (id: string) => void }`. `task`가 `null`이면 렌더링 안 함(HomeScreen이 `selectedTask` state로 제어).

내용:
- 제목, 카테고리, 난이도, XP, 마감 표시.
- `status === 'PENDING'`일 때만: "타이머 시작"/"타이머 중지" 토글 버튼 + 경과 시간 `mm:ss` 표시(클라이언트 `setInterval`로 1초마다 로컬 증가시켜 부드럽게 보여주고, 30초마다 heartbeat 호출로 서버 검증값과 동기화 — 화면엔 서버 값이 아니라 로컬 카운터를 그대로 보여준다, 오차는 무시할 수준).
- "완료" 버튼: 타이머가 돌고 있으면 먼저 `endSession` best-effort 호출 후 기존 `onComplete(task.id)` 호출(HomeScreen의 기존 `handleComplete` 재사용 — 리액션 모달 로직 그대로 이어짐).
- "닫기": 타이머가 돌고 있으면 `endSession` best-effort 호출 후 `onClose()`.
- `status !== 'PENDING'`(COMPLETED/FAILED)일 때는 타이머 UI 없이 정보만 표시 + 닫기 버튼.

**`TaskSheet.tsx` 변경**: 태스크 목록의 각 행(`<View key={t.id}>`)에 새 prop `onOpenTask?: (task: Task) => void`를 받아 행 전체를 `TouchableOpacity`(`testID={`task-row-${t.id}`}`)로 감싸 탭하면 호출한다. 기존 "완료" 버튼(`task-complete-${t.id}`)은 그대로 두되, 이벤트 버블링으로 행의 `onOpenTask`까지 같이 안 눌리도록 `onPress` 핸들러 내부 이벤트 처리는 RN 기본 동작(자식 터치가 부모로 안 전파됨)에 맡긴다.

**`HomeScreen.tsx` 변경**: `selectedTask: Task | null` state 추가. `TaskSheet`에 `onOpenTask={setSelectedTask}` 연결. `MissionModal`을 렌더링하고 `onComplete`엔 기존 `handleComplete`를, `onClose`엔 `() => setSelectedTask(null)`을 연결. 완료 후(`handleComplete` 내부에서 `refresh()` 호출로 태스크 상태가 바뀌면) 모달은 열린 채로 최신 상태(COMPLETED)를 반영하도록 `selectedTask`도 최신 태스크로 갱신 — 리액션 모달이 뜨는 동안 미션 모달이 뒤에 남아있으면 어색하므로, 완료 액션이 트리거되면 미션 모달은 즉시 닫고(`setSelectedTask(null)`) 리액션 모달만 보여준다(기존 서브프로젝트 4 흐름 그대로).

## 에러 처리

- 타이머 시작(`startTaskSession`) 실패: 에러 메시지 표시(`home-error`와 같은 패턴 재사용), 타이머 UI는 시작 전 상태로 유지.
- heartbeat 실패(네트워크 일시 끊김 등): 조용히 무시 — 다음 heartbeat나 `endSession`에서 자연스럽게 이어지고, 최악의 경우 `staleSessionJob`이 정리한다. 사용자에게 에러를 보여주지 않는다(타이핑/집중을 방해하지 않기 위해).
- `endSession` 실패: 조용히 무시(best-effort) — 서버 세션은 `staleSessionJob`이 정리.

## 테스트 전략

- 백엔드: `sessions.test.ts`에 `taskId` 경로 테스트 추가(성공/타 유저 소유 태스크/이미 완료된 태스크/activityId+taskId 둘 다 없음/둘 다 있음), 기존 `activityId` 테스트는 그대로 통과해야 한다(회귀 없음 확인). `vi.useFakeTimers()` 패턴 재사용.
- 모바일: `MissionModal.test.tsx` 신규(타이머 시작/중지, 경과 표시, 완료/닫기 버튼 동작 — `sessions.ts`는 `jest.mock`), `TaskSheet.test.tsx`에 행 탭 시 `onOpenTask` 호출 테스트 추가, `HomeScreen.test.tsx`에 태스크 탭→모달 오픈→완료 시 모달 전환 흐름 테스트 추가.
- 백엔드는 실제 Postgres(`cd backend && npm test`), 모바일은 jest(`cd mobile && npm test`) — 기존 컨벤션 그대로.
