# AI 온보딩 대화 + 목표 설정 (Sub-project 3 of 8) — Design Spec

## 배경

[서브프로젝트 1(RN 앱 골격)](2026-07-17-rn-app-shell-design.md)과 [서브프로젝트 2(꾸미 홈 + XP 성장 시스템)](2026-07-17-kkumi-home-xp-design.md)가 master에 머지되어, 로그인 후 할일을 직접 만들고 완료해 XP로 꾸미를 키우는 앱이 동작한다. 다만 지금까지는 "목표(Goal)" 개념이 없었다 — 할일은 목표 없이 바로 만들어졌다.

이번 서브프로젝트는 GrowMe의 컨셉("내 꿈을 함께 키워나가는 꾸미")의 핵심인 **AI와의 자유 대화로 목표를 이끌어내는 온보딩**을 구현하고, 그 결과로 `Goal` 엔티티를 도입한다. AI 할일 추천/리액션(서브프로젝트 4), 미션 실행+타이머(서브프로젝트 5)는 이번 범위 밖이다.

## 목표

로그인 후 목표가 하나도 없는 사용자는 꾸미와의 자유 대화 화면을 만나고, 대화 중 AI가 목표가 충분히 구체적이라고 판단하면 자동으로 목표를 확정해 홈 화면으로 넘어간다. 이후 프로필에서 언제든 같은 대화로 새 목표를 추가할 수 있고, 홈 화면에서는 여러 목표를 전환하며 각 목표에 속한 할일만 볼 수 있다.

## 범위 밖 (Out of scope)

- AI 할일 추천, 완료/실패 리액션 대화 — 서브프로젝트 4.
- 미션 실행 화면, 타이머 — 서브프로젝트 5.
- 대화 메시지 자체의 영구 저장/재조회 — 이번엔 Goal 결과만 남기고 대화는 버린다.
- 목표를 사용자가 직접 폼으로 입력하는 수동 경로 — 목표는 오직 AI 대화로만 생성.
- 목표 수정/삭제 UI — 이번 범위 밖(생성만).
- 기존 인증·타이머·XP 시스템 변경 — 서브프로젝트 1·2 그대로 재사용.

## 아키텍처

### 데이터 모델 (Prisma)

```prisma
model Goal {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  category  Category
  createdAt DateTime @default(now())
}
```

`User`에 `goals Goal[]` 관계 추가. `Task`에 `goalId String?`(nullable — 서브프로젝트 2에서 목표 없이 생성된 기존 할일과 호환), `goal Goal? @relation(fields: [goalId], references: [id], onDelete: SetNull)`을 추가한다. 목표가 삭제되는 경로는 이번 범위에 없지만, `onDelete: SetNull`로 향후 삭제 기능이 생겨도 할일이 고아 상태로 남지 않게 해둔다.

### 백엔드 AI 연동

새 의존성 `@anthropic-ai/sdk`를 `backend/package.json`에 추가한다(모바일은 새 라이브러리 추가 없음). `backend/.env`에 `ANTHROPIC_API_KEY`를 추가하고(`.env.example`에도 빈 값으로 등록), Claude Messages API를 모델 `claude-sonnet-5`로 호출한다.

**대화는 상태를 저장하지 않는다(stateless).** 모바일이 지금까지의 전체 메시지 배열을 매번 백엔드로 보내고, 백엔드는 그 배열 앞에 시스템 프롬프트를 붙여 그대로 Claude에 전달한다. 목표가 확정되면 `Goal` 레코드만 DB에 남고 대화 내용은 어디에도 저장하지 않는다.

### API 엔드포인트

- `POST /api/goals/chat` — body `{ messages: [{ role: 'user' | 'assistant', content: string }, ...] }`(마지막 항목이 최신 사용자 발화). Claude를 `set_goal` 도구와 함께 호출:
  - 도구 정의:
    ```json
    {
      "name": "set_goal",
      "description": "대화에서 사용자의 목표가 충분히 구체적으로 드러났을 때 호출",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "category": { "type": "string", "enum": ["EXERCISE", "STUDY", "READING", "ETC"] }
        },
        "required": ["title", "category"]
      }
    }
    ```
  - 응답에 `set_goal` 도구 호출이 있으면: `input`으로 `Goal` 레코드 생성 → `{ reply: string, goalSet: true, goal: Goal }` 반환.
  - 도구 호출이 없으면: `{ reply: string, goalSet: false }` 반환(대화 계속).
  - Claude 호출 자체가 실패하면 500. `category`가 유효하지 않은 등 도구 입력이 기대와 다르면 도구 호출을 무시하고 일반 텍스트 응답처럼 처리(`goalSet: false`) — 대화가 끊기지 않게 한다.
- `GET /api/goals` — 로그인한 사용자의 목표 목록(최신순).
- `POST /api/tasks`(서브프로젝트 2에서 만든 기존 라우트 확장) — body에 옵셔널 `goalId` 추가. 값이 오면 그 목표가 실제 요청자 소유인지 검증(아니거나 존재하지 않으면 400), `Task.goalId`에 저장.

### 시스템 프롬프트 (요지)

꾸미가 1인칭 대화체로 말한다. 형식적인 질문지가 아니라 자연스러운 대화로 목표를 이끌어낸다("요즘 뭐가 고민이야?" 류). 사용자가 말한 내용에서 실행 가능한 수준의 구체적인 목표(예: "매일 영어 리스닝 습관 만들기")가 드러났다고 판단되면 그 시점에 `set_goal`을 호출한다. 정확한 프롬프트 문구는 구현 태스크에서 확정한다.

## 화면 (모바일)

- **`OnboardingChatScreen`** — 메시지 배열을 로컬 state로 들고, 전송할 때마다 지금까지의 배열 + 새 메시지를 `POST /api/goals/chat`으로 보내고 응답의 `reply`를 어시스턴트 메시지로 추가. 메시지 리스트(말풍선) + 텍스트 입력 + 전송 버튼 + 응답 대기 중 로딩 표시. `goalSet: true`가 오면 짧은 확인 화면("목표가 생겼어요: OO")을 보여준 뒤 홈으로 이동. 최초 온보딩(목표 0개)일 때는 닫기 버튼이 없고, 프로필에서 진입한 "새 목표 추가"일 때는 닫기 버튼이 있어 취소하고 돌아갈 수 있다(같은 컴포넌트, `canCancel` prop으로 분기).
- **`GoalsContext`**(새 컨텍스트, `AuthContext`와 같은 패턴) — 로그인 상태일 때 `GET /api/goals`를 불러와 `{ goals, isLoading, activeGoalId, setActiveGoalId, isAddingGoal, startAddGoal, stopAddGoal, refreshGoals }`를 제공. `activeGoalId` 기본값은 가장 최근 생성된 목표.
- **`RootNavigator`** 게이팅: 토큰 없음 → `AuthStack`(기존). 토큰 있음 + `goals.length === 0` → `OnboardingChatScreen`(전체 화면, `canCancel=false`). 토큰 있음 + `isAddingGoal === true` → `OnboardingChatScreen`(`canCancel=true`, `MainTabs` 대신 렌더링). 그 외 → `MainTabs`(기존).
- **`ProfileScreen`** — "새 목표 추가" 버튼 추가, 누르면 `GoalsContext.startAddGoal()` 호출.
- **`HomeScreen`** — 꾸미 위쪽에 목표 제목 가로 스크롤 칩(`GoalsContext.goals`) 추가, 탭하면 `setActiveGoalId`. `tasks`를 `activeGoalId`로 필터링해 `TaskSheet`에 전달하고, 할일 추가 시 `goalId: activeGoalId`를 자동으로 붙인다.

## 에러 처리

- `/api/goals/chat` 실패(네트워크/키/레이트리밋) → 채팅 화면에 "다시 시도" 버튼이 달린 인라인 에러 말풍선 추가, 눌러서 같은 메시지 재전송.
- `POST /api/tasks`에 잘못된 `goalId`(타인 소유·존재하지 않음) → 400, 프론트는 서브프로젝트 2와 동일한 인라인 에러 패턴으로 표시.
- `GET /api/goals` 실패 → 서브프로젝트 2에서 만든 재시도 가능한 에러 상태 패턴 재사용.

## 테스팅

- **백엔드:** `POST /api/goals/chat`(Claude API 모킹 — 도구 호출 응답/일반 텍스트 응답/API 에러/유효하지 않은 도구 입력 각 케이스), `GET /api/goals`, `POST /api/tasks`의 `goalId` 검증(타인 소유·존재하지 않음 400, 정상 저장).
- **모바일:** `OnboardingChatScreen`(메시지 전송→응답 렌더, `goalSet` 시 확인 화면, 에러 시 재시도, `canCancel` 분기), `RootNavigator`의 게이팅 분기(토큰 없음/목표 없음/새 목표 추가 중/정상), `ProfileScreen`의 진입 버튼, `HomeScreen`의 Goal 칩 전환 시 `TaskSheet` 필터링.

## Global Constraints

- 기존 인증·타이머·XP 시스템(서브프로젝트 1·2)을 변경하지 않는다.
- 대화 메시지는 DB에 저장하지 않는다 — `Goal` 레코드만 결과로 남는다.
- `@anthropic-ai/sdk`는 백엔드에만 추가한다 — 모바일은 새 라이브러리 추가 없이 기존 `apiFetch` 패턴을 재사용한다.
- 목표는 오직 AI 대화를 통해서만 생성된다 — 수동 입력 폼은 이번 범위 밖.
