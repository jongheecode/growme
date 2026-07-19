# AI 할일 추천 + 완료/실패 리액션 대화

## 배경

서브프로젝트 3(AI 온보딩 + 목표 설정)까지 완료된 상태에서, 목표(Goal)를 실제 할일(Task)로 이어주고 태스크 완료/실패에 꾸미가 반응하도록 만든다. `goalChat.ts`의 stateless Claude tool-use 패턴을 그대로 재사용한다.

## 아키텍처 개요

두 가지 독립적인 기능을 추가한다.

1. **할일 추천**: 목표 생성 직후 자동 1회 + 이후 언제든 버튼으로 추가 요청 가능. Claude가 목표를 보고 1~5개의 태스크 후보(`title`, `category`, `difficulty`, `dueChoice`)를 제안한다. 추천 결과는 **DB에 저장하지 않는다** — 사용자가 개별 수락한 것만 기존 `POST /api/tasks`로 실제 생성한다.
2. **완료/실패 리액션**: `Task`에 `reactionText`, `reactionShownAt` 두 컬럼만 추가한다.
   - **완료**: `PATCH /api/tasks/:id/complete`가 상태 변경과 함께 Claude로 리액션 문구를 생성해 저장하고, `reactionShownAt`을 즉시 세팅한 뒤 응답에 포함한다 (그 자리에서 모달로 바로 보여주므로 "본 것"으로 처리).
   - **실패**: 마감이 지나 lazy하게 FAILED로 바뀌는 기존 흐름(`GET /api/tasks`)에서, `reactionText`가 없는 FAILED 건에 대해 Claude로 리액션을 생성해 저장한다(`reactionShownAt`은 아직 null). 응답에 `pendingReactions: Task[]`를 추가해 내려주고, 클라이언트는 다음 앱/홈 진입 시 이를 하나씩 모달로 보여준 뒤 `PATCH /api/tasks/:id/ack-reaction`으로 확인 처리한다.

**리팩터링**: `goalChat.ts`의 `getAnthropicClient()` lazy-singleton을 `services/anthropicClient.ts`로 추출해 `goalChat`, `taskSuggestions`, `reactions` 세 서비스가 공유한다.

## 데이터 모델

```prisma
model Task {
  // ...기존 필드 그대로...
  reactionText    String?
  reactionShownAt DateTime?
}
```

기존 필드/관계는 변경 없음. 마이그레이션 1개만 추가한다.

## API 명세

### `POST /api/goals/:id/suggest-tasks`
- 요청 바디 없음. `goalId`는 URL 파라미터, 소유권은 기존 goalChat과 동일하게 `userId`로 검증.
- 응답: `{ suggestions: [{ title, category, difficulty, dueChoice }, ...] }` (1~5개, DB 미저장).
- 클라이언트가 수락한 항목은 그대로 기존 `POST /api/tasks` body로 재사용.

### `PATCH /api/tasks/:id/complete` (기존 확장)
- 응답에 `reactionText` 필드 추가. 이미 `reactionShownAt=now`로 저장된 상태.
- 만료(409) 케이스는 기존과 동일, 리액션 생성 안 함.

### `GET /api/tasks` (기존 확장)
- 기존 lazy auto-fail 직후, `reactionText IS NULL AND status = 'FAILED'`인 건에 대해 Claude 호출 후 저장.
- 응답에 `pendingReactions: Task[]` 필드 추가. 기존 `tasks` 배열은 그대로 유지(하위호환).

### `PATCH /api/tasks/:id/ack-reaction` (신규)
- `reactionShownAt`을 now로 세팅, 204 반환.
- 이미 shown이거나 `reactionText`가 없는 경우 409.

## 백엔드 서비스 설계

### `services/anthropicClient.ts` (신규, 공유)
```ts
export function getAnthropicClient(): Anthropic { /* 기존 goalChat.ts의 lazy singleton 이동 */ }
```

### `services/taskSuggestions.ts` (신규)
- 시스템 프롬프트: 꾸미 페르소나 유지 + "목표를 보고 실행 가능한 하위 태스크를 1~5개 제안해. 각 태스크는 오늘 안에 끝낼 만한 크기여야 해."
- `SUGGEST_TASKS_TOOL`: `input_schema`에 `suggestions: array<{title, category(enum), difficulty(enum), dueChoice(enum)}>`. `goalChat.ts`의 `SET_GOAL_TOOL`과 동일한 검증 패턴 재사용.
- 목표의 `title`+`category`만 컨텍스트로 전달, 대화 기록 없음(완전 stateless 단발 호출).

### `services/reactions.ts` (신규)
- `generateReaction(task, personality, outcome: 'COMPLETED' | 'FAILED')`.
- 시스템 프롬프트에 `computePersonality` 결과를 문장으로 녹여 넣는다. 예: "이 사용자는 꾸준한 편이고(STEADY) 마감보다 여유있게 끝내는 편(EASYGOING)이야. 그 성격에 맞는 말투로, 태스크 '{title}'을 {완료/실패}한 것에 대해 한두 문장으로 반응해."
- 성격이 아직 없는 경우(`computePersonality`가 `null`) 중립 톤 프롬프트로 폴백.
- 툴 없이 순수 text 응답만 받는다(구조화된 데이터가 필요 없으므로 goalChat/taskSuggestions보다 단순).

## 에러 처리

- **완료 리액션**: 상태 변경(`complete`) 자체는 Claude 호출과 별개 트랜잭션. Claude 실패 시 `reactionText: null`로 응답하고, 모바일은 null이면 모달을 띄우지 않는다(에러 노출 없이 조용히 스킵).
- **실패 리액션 생성**: `GET /api/tasks` 안에서 태스크별 개별 try/catch. 한 건 실패해도 나머지는 정상 처리되고, 실패한 건은 `reactionText`가 계속 null이므로 다음 GET 때 자동 재시도된다.
- **할일 추천**: Claude 실패 시 502. 모바일은 "지금은 추천을 가져올 수 없어요, 다시 시도해주세요" 같은 단순 에러 상태를 보여준다(`OnboardingChatScreen`의 기존 에러 처리 패턴과 동일선상).
- **ack-reaction 경합**: 두 기기/탭에서 동시에 GET을 부르는 경우를 대비해, `ack-reaction`은 `reactionShownAt IS NULL`일 때만 update하고 아니면 409.
- **입력 검증**: `suggest-tasks`는 타인 소유 `goalId`면 400. Claude가 enum 밖 값을 준 항목은 해당 항목만 드롭(전체 요청을 실패시키지 않음, 0개만 남아도 빈 배열 응답).

## 모바일 컴포넌트 설계

- **API 클라이언트 확장**: `tasks.ts`의 `completeTask`가 `reactionText`도 반환하도록 타입 확장, `ackReaction(id)` 추가, `getTasks()` 응답 타입에 `pendingReactions` 추가. `suggestTasks(goalId)` 추가.
- **`TaskSheet.tsx`**: "추천받기" 버튼 추가 → 로딩 상태(온보딩의 "생각하고 있어요" 패턴 재사용) → 추천 카드 목록 렌더, 카드마다 `수락`/`거절`. 수락 시 기존 `onCreate`와 동일 경로로 `POST /api/tasks`, 거절 시 클라이언트 상태에서만 제거(서버에 남는 것 없음). `완료` 클릭 시 응답의 `reactionText`로 `ReactionModal` 표시.
- **`ReactionModal.tsx`(신규)**: `{ text, outcome, onDismiss }` props만 받는 단순 프레젠테이션 컴포넌트. 완료/실패 흐름이 공유한다. 실제 비주얼은 플레이스홀더([[feedback_design_workflow]]에 따라 최종 디자인은 사용자가 별도로 입힘).
- **`HomeScreen.tsx`**: `pendingReactions`를 큐로 들고 있다가 순차적으로 `ReactionModal` 표시, 닫을 때마다 `ackReaction(id)` 호출 후 다음 것 표시. 완료 직후 즉시-리액션은 이 큐와 별개 경로(ack 불필요, 서버가 이미 `reactionShownAt`을 세팅해둠).

## 테스트 계획

**백엔드**
- `taskSuggestions.test.ts`: 정상 1~5개 파싱, enum 밖 값 섞인 응답에서 해당 항목만 드롭, Claude 실패 시 502, 타인 소유 goalId로 400.
- `reactions.test.ts`: `computePersonality` null일 때 중립 프롬프트 폴백, 4개 성격 조합 각각 프롬프트에 올바르게 반영되는지.
- `tasks.test.ts` 확장: `complete` 성공 시 `reactionText`/`reactionShownAt` 세팅, Claude 실패해도 `complete`는 200 + `reactionText: null`, `GET /tasks`가 새 FAILED 건에 리액션을 채워 `pendingReactions`에 포함, 이미 `reactionText` 있는 FAILED 건은 재호출 안 함(mock call count로 검증), `ack-reaction` 정상/중복(409) 케이스.
- `anthropicClient.test.ts`: lazy singleton 동작 검증(기존 goalChat 테스트에서 이관).

**모바일**
- `TaskSheet.test.tsx` 확장: 추천받기 → 카드 렌더 → 수락 시 콜백 호출, 거절 시 카드만 제거.
- `ReactionModal.test.tsx`(신규): text/outcome 렌더링, dismiss 콜백 검증.
- `HomeScreen.test.tsx` 확장: `pendingReactions` 큐 순차 표시 + ack 호출 검증, 즉시-리액션은 ack 없이 바로 표시되는지.

기존 컨벤션대로 전부 `tsc --noEmit` 클린 + 테스트 그린 기준.
