# GrowMe 제품 명세서

> 2026-07-27 기준(최초 작성 2026-07-23, 출시 전 하드닝 반영해 갱신), 코드베이스를 직접 읽어 작성한 현재 상태 스냅샷. 이후 기능이 추가/변경되면 이 문서도 같이 갱신해야 함.

## 1. 개요

GrowMe는 사용자가 세운 목표를 작은 할일(미션) 단위로 쪼개 실행하고, 완료할 때마다 "꾸미"라는 알에서 자라나는 캐릭터를 키우는 습관 형성 앱이다. AI(Claude)가 목표 설정 대화, 할일 추천, 완료/실패 리액션 생성을 담당한다.

- **모바일**: React Native + Expo (SDK 54), TypeScript
- **백엔드**: Node.js + Express + Prisma + PostgreSQL, TypeScript
- **AI**: Anthropic Claude API (`claude-sonnet-5`)
- **인증**: 이메일/비밀번호(JWT) + 구글/카카오 OAuth(브라우저 기반)

---

## 2. 디자인 시스템

### 2.1 색상 (`mobile/src/theme.ts`)

| 토큰 | 값 | 용도 |
|---|---|---|
| `background` | `#FBF6EE` | 화면 배경 |
| `card` | `#FFFDF9` | 카드/입력창 배경 |
| `border` | `#ECE1D2` | 테두리 |
| `ink` | `#4A4038` | 기본 텍스트 |
| `inkMuted` | `#8A7E72` | 보조 텍스트 |
| `inkFaint` | `#B0A493` | placeholder, 비활성 |
| `green` / `greenDark` / `greenTint` | `#5FA97D` / `#4A8863` / `#F0F8F2` | 주요 액션(완료, 로그인 버튼 등) |
| `gold` / `goldText` / `goldTint` | `#F3C969` / `#B58A2E` / `#FFF6E0` | XP/포인트 강조 |
| `lavender` | `#B7A6E4` | 챌린지 진행률 |
| `peach` | `#EE9E86` | 보조 강조(운동 카테고리 등) |
| `fail` / `failTint` | `#C88A72` / `#F5EDE9` | 에러/실패 상태 |

### 2.2 폰트

- 제목/강조: `Jua_400Regular` (`fonts.heading`)
- 본문: `GowunDodum_400Regular` (`fonts.body`)

### 2.3 카테고리/난이도 라벨

| Category | 라벨 | 색상 |
|---|---|---|
| EXERCISE | 운동 | `#EE9E86` |
| STUDY | 공부 | `#6FA8D8` |
| READING | 독서 | `#B7A6E4` |
| ETC | 기타 | `#F3C969` |

| Difficulty | 라벨 | XP |
|---|---|---|
| EASY | 쉬움 | 10 |
| MEDIUM | 보통 | 20 |
| HARD | 어려움 | 35 |

### 2.4 아이콘 (`mobile/src/components/Icon.tsx`)

24×24 viewBox, stroke 기반 커스텀 SVG 아이콘 세트: `home`, `history`, `friends`, `shop`, `profile`, `ranking`, `challenge`, `search`, `clock`. `active` prop이 true면 일부 도형에 `color+'22'` 반투명 채우기가 추가됨.

### 2.5 캐릭터 "꾸미" 비주얼 (`mobile/src/components/KkumiView.tsx`)

- 순수 `react-native-svg` 도형 조합(원/타원/선/패스)으로 그려지며 사진/이미지 에셋을 쓰지 않음.
- **종(species) 3종** — 백엔드 enum `SPECIES_A/B/C`는 프론트에서 각각 `mint`(민트)/`peach`(피치)/`lav`(라벤더) 팔레트로 매핑됨(자의적 순서, 백엔드는 종에 의미를 부여하지 않음).
- **단계(stage) 0~4**: 0=알, 1=부화, 2=새싹, 3=자람, 4=만개. 단계가 올라갈수록 렌더링 크기(`80+stage*20`)와 귀/뿔 장식이 늘어남(3단계부터 옆 귀, 4단계부터 아래쪽 장식 추가).
- `size` prop으로 내부 지오메트리는 그대로 두고 렌더 크기만 축소해 작은 아바타 슬롯(리스트 썸네일 등)에 끼워 넣을 수 있음.
- **악세서리**: `HAT`(리본/왕관), `FACE`(동그란 안경) 슬롯만 실제로 캐릭터 위에 렌더링됨. `BACKGROUND` 슬롯 아이템은 캐릭터 자체에는 그려지지 않고 상점 미리보기 배경색으로만 쓰임(스펙: `docs/superpowers/specs/2026-07-21-visual-design-integration.md`). 알(0단계)에는 악세서리가 표시되지 않음.

---

## 3. 정보 구조 / 내비게이션

```
RootNavigator (token 유무로 분기)
├─ 비로그인: AuthStack
│   ├─ Login
│   ├─ Signup
│   └─ ForgotPassword
└─ 로그인 + 목표 0개: OnboardingChatScreen (뒤로가기 불가, canCancel=false)
└─ 로그인 + 목표 1개 이상: MainTabs (하단 탭 4개)
    ├─ Home
    ├─ History
    ├─ Shop
    └─ Profile (ProfileStack)
        ├─ ProfileHome
        ├─ Friends
        ├─ Leaderboard
        ├─ Challenges
        ├─ ChallengeDetail
        └─ AccountSettings
    (+ "새 목표 추가" 시 OnboardingChatScreen을 canCancel=true로 오버레이)
```

- 탭 루트 화면(Home/History/Shop/Profile)은 네이티브 헤더를 껐고(`headerShown:false`) 각자 `SafeAreaView`로 상단 노치를 직접 처리.
- `ProfileStack`의 하위 push 화면(Friends/Leaderboard/Challenges/ChallengeDetail/AccountSettings)은 뒤로가기 버튼이 있는 네이티브 헤더를 유지하되 타이틀 텍스트는 비워 화면 자체 제목과 중복되지 않게 함.

---

## 4. 화면별 상세 명세

### 4.1 Login

- 상단 220px 배경(`#FBEAD6`) 안에 알 상태의 `KkumiView` 배치.
- 이메일/비밀번호 입력 → 로그인.
- "비밀번호를 잊으셨나요?" → ForgotPassword로 이동.
- 구분선("또는") 아래 **구글로 계속하기**(흰 배경 아웃라인 버튼), **카카오로 계속하기**(`#FEE500` 배경) 버튼 — `app.json`에 client ID가 설정된 provider만 표시되고, 둘 다 없으면 구분선까지 통째로 숨겨짐(눌리는데 동작 안 하는 버튼을 노출하지 않기 위함).
- 하단에 "회원가입" 전환 링크.
- 실패 시 화면 하단에 인라인 에러 텍스트(모달/토스트 없음).

### 4.2 Signup

- Login과 동일한 알 배너.
- 닉네임/이메일/비밀번호 입력 → 가입 즉시 로그인 처리(별도 이메일 인증 없음).
- 구글/카카오 버튼은 Signup에는 없음(Login에서만 진입 가능).

### 4.3 ForgotPassword

- 2단계 플로우: ① 이메일 입력 → "재설정 링크 요청" (성공 여부와 무관하게 항상 같은 안내 문구 표시, 계정 존재 여부 비노출) → ② 토큰 + 새 비밀번호 입력 필드가 드러남 → 재설정 성공 시 "비밀번호가 변경됐어요" 완료 화면.
- 재설정 링크(토큰 포함)는 `RESEND_API_KEY`가 설정돼 있으면 Resend를 통해 실제 이메일로 발송되고, 없으면 **서버 콘솔 로그**로만 남는다(로컬 개발 기본값). 발송 자체가 실패해도 콘솔 로그 폴백이 있어 재설정이 완전히 막히지는 않음. 이메일 안의 링크는 딥링크 자동 처리가 아니라 토큰을 화면에 직접 입력하는 방식.

### 4.4 OnboardingChatScreen

- 신규 유저(목표 0개) 또는 "새 목표 추가" 시 표시되는 AI 채팅 UI.
- 상단 바: 꾸미 아바타(32px, 원형 클리핑) + "꾸미 / 목표를 함께 정해요" + (재진입 가능 시) 닫기(✕) 버튼. `SafeAreaView`로 상단 노치 아래에 위치.
- 메시지 리스트(사용자=초록 말풍선 우측 정렬, 꾸미=카드색 좌측 정렬) + 입력창. `KeyboardAvoidingView`로 키보드가 올라와도 입력창이 가려지지 않음(iOS `padding`, offset 90 / Android `height`).
- 전송 실패 시 "메시지를 보내지 못했어요" + "다시 시도" 버튼.
- AI가 목표를 충분히 구체적이라고 판단하면(`set_goal` 툴 호출) 목표 확정 화면으로 전환: "목표가 생겼어요: {제목}" + "계속하기" 버튼.
- **"AI 없이 직접 입력할게요"** 링크로 언제든 수동 입력 폼(제목 + 카테고리 4종 칩)으로 전환 가능 — Anthropic API 크레딧이 소진되는 등 AI 채팅 자체가 막혔을 때도 신규 가입자가 목표를 못 만들어 앱을 못 쓰는 상황을 막기 위한 폴백.

### 4.5 Home

- 상단 가로 스크롤 목표 칩 리스트(활성 목표는 진하게, 나머지는 반투명) — `activeGoalId` 전환.
- 중앙에 보유 포인트 배지 + (연속 완료일수가 1일 이상이면) 🔥 스트릭 배지 + 탭 가능한 꾸미 캐릭터(탭하면 KkumiInfoModal 오픈).
- 우하단 플로팅 "오늘의 미션" 시트(`TaskSheet`, 접힌 상태는 `완료수/전체` 원형 버튼):
  - 할일 목록: 완료(초록 체크)/대기(빈 원, 탭하면 완료 처리)/실패(빨간 X) 상태 표시, 카테고리 배지 + 난이도 + XP 배지 + `· 권장 N분`(카테고리별 권장 집중 시간).
  - 하단에 새 할일 추가 폼(제목 입력, 카테고리 4종/난이도 3종/기한(오늘·이번 주) 픽커).
  - "추천받기" 버튼 → AI가 활성 목표 기준 1~5개 하위 태스크 제안, 각 제안 카드에 수락/거절.
  - 활성 목표에 할일이 하나도 없으면 자동으로 추천을 한 번 요청함.
- 할일 탭 → `MissionModal` 바텀시트: 집중 타이머(시작/멈추기, 30초 간격 하트비트 전송) + 완료/포기 버튼. 권장 시간 이상 집중하면 타이머가 초록색으로 바뀌고 "보너스" 배지가 붙음(클라이언트 쪽 근사치 표시 — 실제 보너스 지급 여부는 서버가 세션 누적 시간으로 판정).
- 완료 시 AI가 생성한 리액션 텍스트 + XP/포인트 보상을 `ReactionModal`로 보여줌(권장 시간 이상 집중했다면 보너스 배지 포함). 이번 완료로 **첫 부화**(알→종 확정)가 일어나면 알이 흔들리는 애니메이션(1.5초) 후 종/단계를 리빌하는 2단계 연출.
- 실패(기한 초과)로 전환된 할일의 리액션은 다음 목록 조회 시 큐에 쌓여 하나씩 순차적으로 보여줌(즉시 완료 리액션과 별개 큐). AI 리액션 생성이 실패하면(크레딧 소진 등) 완료/실패 각각의 프리셋 문구 풀에서 무작위로 골라 대신 보여줌 — 리액션 텍스트가 영영 비어있는 상태가 되지 않음.

### 4.6 History

- 완료/실패한 할일을 최신순으로 카드 리스트(제목, 완료/실패 배지, 카테고리, 난이도, 날짜, 완료 시 +XP, 집중 시간(mm:ss)).
- 빈 상태: 꾸미(2단계, 시계 아이콘 배지) + "아직 기록이 없어요".

### 4.7 Shop

- 상단 보유 포인트 배지.
- **슬롯 필터 탭**: 전체 / 모자(HAT) / 얼굴(FACE) / 배경(BACKGROUND).
- 아이템 그리드(2열): 미리보기(HAT/FACE는 해당 악세서리를 낀 꾸미 렌더, BACKGROUND는 색상 배경만) + 이름/가격 + 구매(미보유)/장착(보유) 버튼.
- 카탈로그 5종: 리본(HAT,50P) · 왕관(HAT,200P) · 동그란 안경(FACE,80P) · 별 배경(BACKGROUND,120P) · 무지개 배경(BACKGROUND,300P).
- 같은 슬롯은 동시에 하나만 장착 가능(장착 시 같은 슬롯의 기존 장착 해제).

### 4.8 Profile

- **통계 카드**: 닉네임, 가입일(`YYYY.MM 가입`), 보유 목표 수.
- **성격 유형 카드**: "내 꾸미 성격 유형" + 유형명/설명(계산 전엔 "성격 파악 중...") — KkumiInfoModal과 별개로 여기서도 항상 노출.
- 메뉴 그리드(2열): 친구 / 랭킹 / 챌린지.
- **오늘 미션 리마인더 토글**: 켜두면 오늘 미션이 남아있을 때만 20시 전에 로컬 알림이 동적으로 예약됨(§5.9), 권한 거부 시 안내 문구.
- **계정 설정** 진입 카드.
- "+ 새 목표 추가" 버튼(온보딩 챗을 취소 가능 상태로 오버레이).
- 로그아웃 버튼.

### 4.9 AccountSettings

- 이메일 변경(현재 이메일 프리필, 중복 시 "이미 사용 중인 이메일이에요").
- 비밀번호 변경(현재/새 비밀번호, 기존 `change-password` 엔드포인트 재사용).
- 회원 탈퇴(확인 Alert → 탈퇴 시 계정 및 연관 데이터 cascade 삭제 후 자동 로그아웃).

### 4.10 Friends

- 닉네임으로 친구 검색/요청 전송.
- 받은 친구 요청 목록(수락 버튼).
- 내 친구 목록: 아바타(꾸미 축소 렌더) + 닉네임 + 단계/누적XP, 각 행에 **"⋯" 액션 메뉴**(신고/차단).
  - 신고 선택 시 사유 프리셋(스팸/부적절한 콘텐츠/괴롭힘/기타) 중 선택.
  - 차단 시 즉시 친구 관계 해제, 이후 서로 친구 요청 불가.
- 빈 상태: 꾸미 + 돋보기 배지 + "친구가 없어요".

### 4.11 Leaderboard

- 스코프 토글(친구/전체) × 기간 토글(주간/전체기간) — 총 4가지 조합.
- 순위 리스트(순위, 닉네임, 누적 XP). **내 순위 행에는 액션 메뉴가 없음**(자기 자신 차단/신고 방지), 그 외 행에는 Friends와 동일한 "⋯" 신고/차단 메뉴.
- 차단한 상대는 전체 스코프 랭킹에서 자동 제외(양방향).

### 4.12 Challenges

- 참여 중인 챌린지 목록(진행률 바 + `이름 — n% (달성XP/목표XP)`), 탭하면 상세로 이동.
- 새 챌린지 만들기: 이름 입력 + **목표 XP 바텀시트 칩 선택**(50/100/200/500/1000 프리셋 중 택1) → 자동으로 오늘~7일 뒤를 기간으로 생성.
- 초대코드로 참여.

### 4.13 ChallengeDetail

- 전체 진행률(모든 멤버 달성XP 합 / 목표XP) 카드.
- 멤버별 진행률 리스트(달성 XP 내림차순 정렬, 각자 상대적 바(최고 달성자 대비 %)).
- 초대코드 표시(공유용).
- 생성자가 아니면 "나가기" 버튼(생성자는 못 나감), 생성자면 대신 "챌린지 삭제" 버튼(확인 Alert 후 삭제, 멤버 전원 포함 챌린지 자체가 사라짐).

---

## 5. 핵심 기능 상세

### 5.1 목표(Goal) & AI 온보딩 챗

- 목표는 AI와의 자유 대화로만 생성됨(수동 입력 폼 없음). 시스템 프롬프트가 "형식적 질문지처럼 묻지 말고 자연스럽게" 유도하도록 지시.
- AI가 `set_goal` 툴을 호출하면 목표가 즉시 DB에 생성되고 대화가 종료됨. 목표가 막연하면 툴을 호출하지 않고 되물음.
- 한 유저가 여러 목표를 동시에 가질 수 있고(Home 상단 칩으로 전환), 할일은 목표에 종속(`goalId`, nullable).

### 5.2 할일(Task) / 미션

- 카테고리(4)·난이도(3)·기한(오늘/이번 주) 조합으로 생성, XP는 난이도로 고정(10/20/35).
- `GET /api/tasks` 호출 시마다 기한 지난 PENDING 할일을 서버가 즉시 `FAILED`로 전환(별도 배치잡 없이 조회 시점에 지연 평가).
- 완료 시 `GrowthProfile.points`가 XP만큼 증가하고, AI가 완료/실패 각각에 대해 개인화된 리액션 문장을 생성(사용자의 "성격 유형" 반영, best-effort). **AI 호출이 실패하면(크레딧 소진 등) `FALLBACK_REACTIONS` 프리셋 문구 풀에서 무작위로 골라 대신 저장** — 리액션이 null로 남아 매 조회마다 재시도되는 일이 없음.
- 완료 처리는 마감 이후면 서버가 즉시 실패로 전환하고 409 에러 반환.
- **카테고리별 권장 집중 시간**: 운동 30분 / 공부 45분 / 독서 60분 / 기타 20분(`RECOMMENDED_MINUTES`, 백엔드·모바일 양쪽에 수동 동기화). 완료 시점까지 해당 할일에 연결된 세션들의 `verifiedSeconds` 합이 권장 시간 이상이면 XP에 1.2배(`TIMER_BONUS_MULTIPLIER`) 보너스가 붙음 — 타이머를 여러 번 시작/정지해도 누적으로 판정. 모바일 미션 모달의 실시간 "보너스 달성" 표시는 진행 중인 세션만 보는 클라이언트 근사치이고, 실제 지급 여부는 서버가 재계산.
- **목표 수동 입력**: `POST /api/goals`로 AI 채팅을 거치지 않고 제목+카테고리만으로 목표를 바로 만들 수 있음(온보딩 챗 화면의 폴백 UI에서 사용).

### 5.3 성장(Growth) / 꾸미 캐릭터

- `totalXp`(완료 할일 XP 합)이 0 초과가 되는 순간 3종 중 하나가 **랜덤으로 확정**(이후 불변).
- 종별 단계 임계값(누적 XP 기준):

  | 종 | 1단계 | 2단계 | 3단계 | 4단계 |
  |---|---|---|---|---|
  | SPECIES_A | 50 | 150 | 400 | 900 |
  | SPECIES_B | 60 | 180 | 450 | 1000 |
  | SPECIES_C | 40 | 130 | 350 | 800 |

- **포인트(points)**와 **누적 XP(totalXp)**는 별개 값 — XP는 단계 산정에, 포인트는 상점 구매에 쓰임(포인트는 XP와 1:1로 적립되지만 상점에서 소비되면 줄어들고, XP는 절대 줄지 않음).
- **성격 유형**: 완료/실패 이력이 3건 이상 쌓이면 계산. 축A(완료율 70%↑=STEADY / 미만=LOOSE) × 축B(기한의 절반 이전 완료 비율 50%↑=EASYGOING / 미만=LASTMINUTE) → 4유형(산책가형/질주러형/몽상가형/벼락치기형). KkumiInfoModal과 Profile 화면 양쪽에 노출.
- **연속 완료일수(스트릭)**: 완료한 할일의 `completedAt` 날짜를 모아 계산(별도 컬럼 저장 없이 personality와 같은 compute-on-read 방식). 오늘 아직 아무것도 완료 안 했어도 어제까지 이어져 있었다면 스트릭이 끊긴 게 아니라 "오늘 진행 중"으로 취급 — 자정 넘기자마자 스트릭이 사라지지 않게 함. `currentStreak`(현재)/`longestStreak`(역대 최고) 둘 다 응답에 포함.

### 5.4 상점 / 악세서리

- 아이템은 서버 기동 시(`GET /items` 호출마다) 카탈로그가 upsert되어 항상 최신 5종 유지.
- 구매는 포인트 차감 + 소유권 부여가 하나의 트랜잭션.
- 슬롯당 동시 장착 1개 제한.

### 5.5 친구 / 랭킹 / 챌린지 (소셜)

- 친구 요청은 닉네임 검색 기반(고유 식별자 공유 없이 닉네임 텍스트로 매칭, `findFirst`로 첫 매치만 사용). **가입/OAuth 최초 가입 시 닉네임이 이미 있으면 서버가 랜덤 hex 4자리를 자동으로 붙여 유니크하게 만듦**(거부하지 않고 자동 보정 — 동명이인으로 인한 친구 검색 혼선을 줄임).
- 랭킹은 "전체"(모든 유저의 완료 XP 합, 상위 50명) / "친구"(본인+수락된 친구만) × "주간"(최근 7일 완료분) / "전체기간".
- 챌린지는 기간 내 완료 XP 합으로 진행률 계산(카테고리 지정 시 해당 카테고리만 집계), 초대코드로 참여. 생성자는 탈퇴는 못 하지만 **챌린지 자체를 삭제**할 수 있음(멤버 전원 포함 사라짐), 일반 멤버는 삭제 권한 없음.

### 5.6 신고 / 차단 (안전 기능)

- 차단: 친구 관계 자동 해제 + 이후 신규 친구 요청 양방향 차단 + 랭킹(전체)에서 상호 제외. 차단 해제 가능.
- 신고: 사유(프리셋 텍스트) 기록만 하고 별도의 신고 처리/검토 UI는 없음(운영자 대시보드 미구현 — DB에 `Report` 로우만 쌓임).
- 자기 자신 차단/신고는 서버가 400으로 거부.

### 5.7 포커스 세션 (타이머)

- 미션 모달에서 "타이머 시작" → 세션 생성, 30초마다 하트비트 전송(끊기면 다음 하트비트/종료 시 최대 `MAX_GAP_SECONDS`만큼만 인정 — 백그라운드 방치로 시간이 조작되는 것 방지).
- History의 "집중 시간"은 해당 할일에 연결된 세션들의 `verifiedSeconds` 합.

### 5.8 인증

- 이메일/비밀번호: bcrypt 해시, JWT 30일 만료.
- **비밀번호 재설정**: SHA-256 해시된 1회용 토큰(1시간 만료). `backend/.env`의 `RESEND_API_KEY`가 채워져 있으면 Resend REST API로 실제 이메일을 발송하고, 비어있으면(로컬 개발 기본값) 서버 콘솔 로그로만 링크가 남음. 발송 자체가 실패해도 콘솔 로그 폴백이 있어 재설정 기능이 완전히 막히지는 않음(`backend/src/services/mailer.ts`).
- **구글/카카오 로그인**: 네이티브 SDK 대신 `expo-auth-session` 브라우저 기반 OAuth(구글은 `id_token`+nonce, 카카오는 `access_token` 암묵적 플로우). 카카오 네이티브 SDK는 Expo Go에서 로드 불가능해서 의도적으로 회피. **실제 로그인 자체는 Google Cloud Console/Kakao Developers에 앱을 등록하고 발급받은 client ID를 `mobile/app.json`의 `extra.googleClientId`/`kakaoClientId`, 백엔드 `.env`의 `GOOGLE_CLIENT_ID`/`KAKAO_REST_API_KEY`에 채워야 동작함 — 현재는 빈 값이라 Login 화면에서 해당 버튼(들)이 아예 숨겨짐.**
- **레이트리밋**: `/api/auth/*`(로그인/회원가입/비밀번호 재설정/구글·카카오 로그인)에 15분당 20회 제한.

### 5.9 알림

- 로컬 전용(서버 푸시 아님, 디바이스 토큰 저장/발송 인프라 없음). 매일 고정 시각이 아니라, **홈 화면을 새로고침할 때마다 오늘 PENDING 할일이 남아있는지 확인해 동적으로 재예약**하는 방식(`syncMissionReminder`, 20시 이전이고 오늘 미션이 남아있을 때만 예약). 오늘 미션을 이미 다 끝냈으면 알림이 아예 예약되지 않아 불필요한 리마인더가 오지 않음 — 단, 앱이 완전히 닫힌 동안의 상태 변화는 반영 못 하는(서버 푸시가 아닌) 클라이언트 근사치.

### 5.10 오프라인 / 에러 표시

- 앱 전역(`App.tsx` 루트)에 `OfflineBanner`가 항상 마운트되어 있고, 기기가 오프라인이거나(연결은 됐지만) 인터넷이 안 잡힐 때 화면 최상단에 빨간 배너로 알림.
- 이와 별개로 `useErrorMessage()` 훅이 화면 10곳(Home/History/Shop/Friends/Leaderboard/Challenges/ChallengeDetail/OnboardingChat/AccountSettings/ForgotPassword)의 실패 메시지에 적용돼, 오프라인 상태일 땐 "인터넷 연결을 확인해주세요"로 통일되고 온라인인데 실패했을 땐 화면별 원래 문구(예: "챌린지 정보를 불러오지 못했어요")가 그대로 나옴 — 두 경우를 문구로 구분할 수 있게 됨.

---

## 6. 데이터 모델 (Prisma)

| 모델 | 핵심 필드 | 비고 |
|---|---|---|
| `User` | email(nullable, unique) · passwordHash(nullable) · oauthProvider/oauthId · nickname · bio | OAuth 유저는 email/passwordHash가 없을 수 있음 |
| `PasswordResetToken` | tokenHash(unique) · expiresAt · usedAt | 평문 토큰은 저장 안 함(SHA-256 해시만) |
| `BlockedUser` | blockerId · blockedId | `@@unique([blockerId, blockedId])` |
| `Report` | reporterId · reportedUserId · reason | 검토 상태 필드 없음 |
| `Activity` | name · category · deletedAt(soft delete) | 레거시 자유 활동 기록(과거 히스토리 집계용, 현재 UI에서 직접 CRUD하는 화면 없음) |
| `Session` | activityId? · taskId? · verifiedSeconds · lastHeartbeatAt | Activity/Task 둘 중 정확히 하나에 연결 |
| `Task` | goalId? · category · difficulty · xpValue · status(PENDING/COMPLETED/FAILED) · reactionText/reactionShownAt | |
| `Goal` | title · category | |
| `GrowthProfile` | species?(1:1 User) · points | |
| `Friendship` | requesterId · addresseeId · status(PENDING/ACCEPTED) | `@@unique([requesterId, addresseeId])` — 단방향 유니크라 역방향 중복 요청은 로직으로 체크 |
| `Challenge` / `ChallengeMember` | targetXp · startDate/endDate · inviteCode(unique) | |
| `AccessoryItem` / `UserAccessory` | slot(HAT/FACE/BACKGROUND) · equipped | |

---

## 7. 백엔드 API 요약

| 라우트 | 인증 | 설명 |
|---|---|---|
| `POST /api/auth/signup`, `/login` | - | 이메일/비밀번호 |
| `POST /api/auth/change-password`, `/forgot-password`, `/reset-password` | change-password만 필요 | |
| `POST /api/auth/google`, `/api/auth/kakao` | - | OAuth 토큰 검증 후 upsert 로그인 |
| `GET/PATCH/DELETE /api/users/me` | ✓ | 프로필 조회/수정(닉네임·bio·email)/탈퇴 |
| `GET/POST /api/goals`, `POST /api/goals/chat`, `POST /api/goals/:id/suggest-tasks` | ✓ | AI 챗 기반 목표 생성, 하위 태스크 추천 |
| `GET/POST /api/tasks`, `PATCH /:id/complete`, `DELETE /:id`, `PATCH /:id/ack-reaction` | ✓ | |
| `GET /api/growth` | ✓ | totalXp/species/stage/points/personality |
| `GET /api/shop/items`, `POST /purchase`, `PATCH /equip`, `GET /my-accessories` | ✓ | |
| `GET/POST /api/friends`, `/requests`, `/:id/accept`, `DELETE /:id` | ✓ | |
| `GET /api/leaderboard?scope=&range=` | ✓ | |
| `POST/GET /api/challenges`, `/mine`, `/:id`, `/join`, `DELETE /:id/leave` | ✓ | |
| `POST/GET/DELETE /api/safety/block(ed)`, `POST /report` | ✓ | |
| `POST /api/sessions/start`, `/:id/heartbeat`, `/:id/end` | ✓ | |
| `GET /api/history`, `/history/tasks` | ✓ | |
| `GET /api/health` | - | 헬스체크 |

전체 라우트에 `express-rate-limit`(인증 라우트만) 외 별도 rate limit 없음. CORS는 `ALLOWED_ORIGINS` 환경변수로 화이트리스트 가능(비우면 전체 허용 — 로컬 개발 기본값).

---

## 8. 알려진 제약 / 미완성 항목

- **AI 기능(목표 챗, 태스크 추천, 완료/실패 리액션)이 Anthropic API 크레딧에 의존** — 크레딧이 없으면 관련 API 호출은 여전히 500/502로 실패한다. 다만 목표 생성은 "AI 없이 직접 입력"(`POST /api/goals`) 폴백이 있고, 완료/실패 리액션은 AI 실패 시 프리셋 문구로 대체되므로 신규 가입이나 미션 완료 자체가 막히지는 않음(§5.1, §5.2 참고).
- 구글/카카오 로그인은 client ID가 없으면(현재 기본값) Login 화면에서 **버튼 자체가 숨겨짐** — 이전엔 눌러도 동작 안 하는 버튼이 노출됐었지만 지금은 아예 안 보임. 실제 로그인을 켜려면 §5.8의 client ID를 채워야 함.
- 비밀번호 재설정 메일은 `RESEND_API_KEY`를 채워야 실제 발송된다 — 비어있으면(현재 기본값) 여전히 콘솔 로그로만 남음.
- 이메일 인증 절차 없음(가입 즉시 사용 가능, 이메일 소유 확인 안 함).
- 신고 기능은 **접수만 되고 검토/처리 UI 없음**(의도적으로 범위에서 제외 — 운영자 대시보드는 만들지 않기로 함).
- 알림은 로컬 전용, 1건뿐(§5.9의 동적 재예약 로직으로 개선됐지만 여전히 서버 발 푸시나 사용자 지정 시간/다중 알림은 없음).
- 닉네임은 중복 시 자동으로 유니크해지지만(§5.5), 그렇다고 "고유 식별자"가 생기는 건 아니라서 친구 검색은 여전히 텍스트 매칭(`findFirst`) 기반.
- EAS Build 설정은 준비돼 있지만 실제 빌드는 트리거된 적 없음(Expo 계정 로그인 필요) — Sentry의 모바일 쪽 연동도 여기에 발이 묶여 있음(아래 항목 참고).
- **에러 트래킹**: 백엔드는 `SENTRY_DSN`을 채우면 동작하도록 배선 완료(§7 근처 `services/sentry.ts`, 캐치올 에러 미들웨어). **모바일은 아직 미연동** — `@sentry/react-native`는 Expo Go 표준 바이너리에 없는 네이티브 모듈을 요구해서, 커스텀 dev client나 EAS 빌드 없이 지금 Expo Go로 테스트 중인 상태에 그냥 추가하면 깨질 수 있음. 위 EAS Build 항목이 먼저 해결돼야 붙일 수 있음.
- 스트릭(§5.3)은 서버 로컬 시간대(자정) 기준으로 "하루"를 계산 — 사용자 기기의 타임존을 별도로 반영하지 않음.
- 위젯, 서버 푸시 알림 인프라는 의도적으로 이번 스코프에서 제외.
