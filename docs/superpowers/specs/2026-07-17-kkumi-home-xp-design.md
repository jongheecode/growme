# 꾸미 홈 + XP 성장 시스템 (Sub-project 2 of 8) — Design Spec

## 배경

[서브프로젝트 1(RN 앱 골격)](2026-07-17-rn-app-shell-design.md)이 완료되어 로그인/회원가입 후 홈/히스토리/프로필 탭으로 이동하는 빈 껍데기 앱이 master에 있다. 이번 서브프로젝트는 그 위에 GrowMe의 새 코어 루프인 "할일(미션) 완료 → XP 획득 → 꾸미 성장"을 얹는다. AI 대화(목표 설정, 할일 추천, 완료/실패 리액션)와 타이머는 각각 서브프로젝트 3~5의 범위이며 이번에는 다루지 않는다.

기존 백엔드에는 시간 게이지 기반(`Growth.currentGauge`, 초 단위 세션 누적, 3일 후 감쇠) 성장 시스템이 있다. 이번 서브프로젝트에서 이 모델을 완전히 대체한다.

## 목표

사용자가 할일을 직접 만들고(제목/카테고리/난이도/기한), 완료하면 XP를 얻어 꾸미가 성장하는 것을 홈 화면에서 볼 수 있게 한다. 꾸미는 부화 시 3종 중 하나로 랜덤 확정되고, 이후 행동 패턴에 따라 2축 4유형의 성격이 계산되어 홈 화면에서 확인할 수 있다.

## 범위 밖 (Out of scope)

- AI 대화 기반 목표 설정, AI 할일 추천, AI 생성 완료/실패 리액션 — 서브프로젝트 3, 4.
- 미션 실행 화면, 할일별 타이머 — 서브프로젝트 5.
- 대화 데이터 기반 성격 정교화 — 지금은 미션 완료/실패 이력만으로 계산.
- 실제 꾸미 시각 자산(종/단계별 아트, 배경 아트) — 회색 도형 placeholder로 대체, 사용자가 나중에 실제 아트로 교체.
- Goal(목표) 엔티티 — Task만 먼저 구현, Goal은 서브프로젝트 3(AI 온보딩)에서 함께 도입.
- 히스토리/소셜/포인트샵 — 각각 이후 서브프로젝트.

## 아키텍처

### 데이터 모델 (Prisma)

```prisma
enum Category {
  EXERCISE
  STUDY
  READING
  ETC
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum TaskStatus {
  PENDING
  COMPLETED
  FAILED
}

enum Species {
  SPECIES_A
  SPECIES_B
  SPECIES_C
}

model Task {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  category    Category
  difficulty  Difficulty
  xpValue     Int
  dueAt       DateTime
  status      TaskStatus @default(PENDING)
  completedAt DateTime?
  createdAt   DateTime   @default(now())
}

model GrowthProfile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  species   Species?
  createdAt DateTime @default(now())
}
```

`User`에 `tasks Task[]`, `growthProfile GrowthProfile?` 관계 추가. `totalXp`, 성장 단계, 성격 유형은 컬럼으로 저장하지 않고 `Task` 완료 이력에서 매 요청마다 계산한다(아래 "계산 로직" 참고) — 기존 코드의 `recomputeDominantCategory`(세션을 스캔해 그때그때 계산)와 같은 패턴이다. 저장하는 값은 `GrowthProfile.species` 하나뿐인데, 이는 계산값이 아니라 "부화 시 1회 랜덤 확정 후 고정"되는 사실이기 때문이다.

### 기존 시간 게이지 코드 정리

다음을 삭제한다:
- `Growth` Prisma 모델
- `backend/src/services/growth.ts`, `backend/src/services/growth.test.ts`
- `backend/src/routes/growth.ts`, `backend/src/routes/growth.test.ts`
- `backend/src/services/decay.ts`
- `backend/src/jobs/decayJob.ts`, `backend/src/jobs/decayJob.test.ts`
- `app.ts`의 `/api/growth` 라우터 마운트
- `cron.ts`의 decay job 등록

다음은 유지한다(타이머 재구현은 서브프로젝트 5 범위):
- `Session`, `Activity` 모델과 `backend/src/routes/sessions.ts`, `backend/src/jobs/staleSessionJob.ts` — 다만 `sessions.ts`에서 `applySessionToGrowth` 호출과 관련 import는 제거한다(더 이상 존재하지 않는 `Growth` 모델을 참조하므로). 세션 검증 자체(heartbeat, `verifiedSeconds` 집계)는 그대로 둔다.
- 웹 `frontend/`의 `KkumiCharacter.tsx`, `frontend/src/api/growth.ts` — 웹은 이미 폐기 대상이라 손대지 않는다.

### API 엔드포인트

- `POST /api/tasks` — body `{ title: string, category: Category, difficulty: Difficulty, dueChoice: 'TODAY' | 'THIS_WEEK' }`. 서버가 `dueAt`(TODAY → 오늘 23:59:59, THIS_WEEK → 이번 주 일요일 23:59:59, 서버 로컬 시간 기준)과 `xpValue`(EASY=10, MEDIUM=20, HARD=35)를 계산해 `PENDING` 상태로 생성.
- `GET /api/tasks` — 인증된 사용자의 할일 목록 반환. 조회 시점에 `dueAt < now`이고 상태가 `PENDING`인 항목을 `FAILED`로 갱신(DB에 반영) 후 반환한다(lazy 자동실패, 별도 크론 없음).
- `PATCH /api/tasks/:id/complete` — 대상이 `PENDING`이고 `dueAt >= now`일 때만 `COMPLETED` + `completedAt=now`로 전환, XP는 `GET /api/growth/me`가 다음 조회 시 자동 반영. 이미 기한이 지났으면 409 `{ error: 'task expired' }`. 본인 소유가 아니면 404.
- `DELETE /api/tasks/:id` — `PENDING` 상태만 삭제 가능(완료/실패된 할일은 이력이므로 삭제 불가, 400).
- `GET /api/growth/me` — 아래 계산 결과 반환:
  ```json
  {
    "totalXp": 145,
    "species": "SPECIES_B",
    "stage": 2,
    "xpIntoStage": 45,
    "xpToNextStage": 100,
    "personality": { "axisA": "STEADY", "axisB": "EASYGOING", "type": "STEADY_EASYGOING" }
  }
  ```
  `species`는 아직 부화 전이면 `null`(프론트는 "알" 상태로 표시). `personality`는 완료+실패 합계가 3건 미만이면 `null`.

### 계산 로직

**부화(종 확정):** `totalXp`가 0에서 양수로 바뀌는 최초의 `PATCH .../complete` 처리 중, `GrowthProfile.species`가 비어있으면 3종 중 랜덤 1개를 뽑아 저장(같은 트랜잭션 내에서 upsert). 이후 절대 바뀌지 않는다.

**단계(stage):** 종별로 다른 XP 임계값 테이블(예: `SPECIES_A: [0, 50, 150, 400]`, B/C는 다른 곡선)에서 `totalXp`가 속하는 구간의 인덱스. 기존 `getStageForGauge`와 동일한 순회 로직, 단위만 초→XP, 테이블만 종별로 다름.

**성격(2축 4유형):** 사용자의 완료+실패 `Task` 전체를 조회해 계산.
- 축 A (꾸준함↔느슨함): 완료율 = `완료 수 / (완료 수 + 실패 수)`. `≥ 0.7` → `STEADY`, 미만 → `LOOSE`.
- 축 B (여유↔버티는형): 완료된 할일 중, `completedAt`이 `createdAt`~`dueAt` 구간의 앞쪽 50% 이내에 들어온 비율. `≥ 0.5` → `EASYGOING`, 미만 → `LASTMINUTE`.
- 완료+실패 합계가 3건 미만이면 `personality: null` 반환.
- `type`은 두 축을 이어붙인 문자열(`STEADY_EASYGOING` 등 4가지)로, 프론트가 유형별 라벨/설명을 매핑해 표시.

이 계산은 서브프로젝트 3/4에서 대화 데이터가 쌓이면 같은 함수에 신호를 더 얹는 방식으로 확장한다(지금 구조를 갈아엎지 않음).

## 화면 (모바일)

- **HomeScreen** — 집/방 느낌의 정적 배경(placeholder 도형), 중앙에 꾸미(회색 도형, `species`+`stage`로 크기/색조만 다르게, 실제 아트는 나중 교체). 우하단에 원형 버튼(오늘+이번 주 마감 중 미완료 개수, 예 "2/4") — 탭하면 `react-native-reanimated`로 커지며(~0.38s) 하단 시트로 전환.
- **꾸미 정보 모달** — 꾸미를 탭하면 오픈. 종(placeholder 이름), 현재 단계, XP 진행바(`xpIntoStage`/`xpToNextStage`), 성격 배지(4유형 중 하나 또는 "성격 파악 중...").
- **할일 시트** — 오늘/이번 주 할일 목록(카테고리 태그, XP 뱃지, 완료 체크). 완료 탭 시 "+10XP" 스타일 짧은 피드백 후 홈 화면의 XP 진행바 갱신. 상단 "+" 버튼으로 할일 추가 폼(제목 입력, 카테고리 선택, 난이도 버튼 하/중/상, 오늘/이번주 토글) 오픈. 배경 탭 또는 버튼 재탭 시 애니메이션 역재생으로 닫힘.
- 하단 탭바(홈/히스토리/프로필)는 서브프로젝트 1 그대로, 이번엔 변경하지 않는다.

## 에러 처리

- 할일 생성/완료/삭제 API 실패는 폼/목록에 인라인 에러 텍스트로 표시.
- 만료된 할일 완료 시도(409)는 "이미 기한이 지났습니다" 메시지로 안내 후 목록을 새로고침(자동실패 반영).
- `GET /api/growth/me` 실패 시 홈 화면은 꾸미 영역에 재시도 가능한 에러 상태를 표시.

## 테스팅

- **백엔드:** `Task` CRUD 라우트(생성, 목록 조회 시 lazy-fail, 완료, 만료 완료 시도 409, 삭제, 타인 소유 404), `growth` 서비스의 단계 계산·부화(랜덤 종 확정이 최초 1회만 일어나고 이후 고정됨)·성격 계산(완료율/타이밍 각 케이스, 3건 미만 시 null), `/api/growth/me` 응답 shape, `sessions.ts`에서 growth 관련 코드 제거 후 기존 세션 테스트 통과.
- **모바일:** 할일 추가 폼 제출 → 목록 반영, 완료 탭 → XP/진행바 갱신, 원형 버튼 → 시트 전환 상태, 꾸미 탭 → 정보 모달 오픈 및 필드 표시, 성격 데이터 부족 시 "파악 중" 문구 렌더, 알 상태(`species: null`) 렌더.

## Global Constraints

- 기존 인증(JWT, `AuthContext`)과 서브프로젝트 1의 네비게이션 구조를 변경하지 않는다.
- `Session`/`Activity` 모델과 관련 라우트는 삭제하지 않는다(서브프로젝트 5 재사용 예정) — `growth` 연동 코드만 제거한다.
- 웹 `frontend/`는 이번에도 수정·삭제하지 않는다.
- 실제 시각 자산은 만들지 않는다 — species/stage를 key로 하는 placeholder 컴포넌트 구조만 만들어 나중 자산 교체가 쉽게 한다.
