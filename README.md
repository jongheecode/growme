# 그로우미 (GrowMe)

할일을 완료하면 캐릭터 "꾸미"가 XP를 얻어 성장하는 React Native 앱입니다. AI가 사용자의 목표에 맞는 할일을 추천하고, 완료/실패에 반응하며, 친구와 랭킹·챌린지로 경쟁하고, 모은 포인트로 꾸미를 꾸밀 수 있습니다.

> V1은 타이머 기반 웹(PWA) 서비스였습니다. V2에서 "할일 완료로만 성장한다"는 원칙으로 React Native 앱으로 전면 피벗했습니다. `frontend/`는 V1의 잔재로 더 이상 사용하지 않습니다 — 실제 앱은 `mobile/`입니다.

## 핵심 컨셉

체크박스가 아니라 **할일 완료(Task 완료)** 로만 꾸미가 성장합니다. 완료한 할일의 XP(`xpValue`)가 쌓이면 성장 단계가 올라가고, 같은 XP가 포인트샵 화폐로도 적립됩니다. AI가 사용자의 목표(Goal)를 바탕으로 할일을 추천하고, 완료/실패 시 짧은 리액션 메시지를 보여줍니다.

## 스택

- **모바일**: React Native + Expo (`mobile/`)
- **백엔드**: Node.js + Express + Prisma (`backend/`)
- **DB**: PostgreSQL
- **AI**: Anthropic API (목표 기반 할일 추천, 완료/실패 리액션)

## 완료된 기능 (V2 RN 피벗, 1~8)

1. **앱 셸 & 인증** — Expo RN 앱, 이메일/구글/카카오 로그인, JWT 인증
2. **꾸미 홈 & XP 성장** — 할일 완료 시 XP 적립, 종/성장단계에 따른 꾸미 렌더링
3. **AI 온보딩 & 목표 설정** — 대화형 온보딩으로 목표(Goal) 수집
4. **AI 할일 추천 & 리액션** — 목표 기반 할일 제안, 완료/실패 시 AI 리액션 메시지
5. **미션 타이머 / 세션 인증** — 할일별 몰입 세션 기록 및 인증
6. **히스토리** — 완료/실패한 할일 목록, 카테고리·난이도·XP·누적 몰입시간 표시
7. **소셜 (친구 · 랭킹 · 챌린지)** — 친구 요청/수락, XP 기반 리더보드(친구/전체, 주간/전체기간), 기간제 챌린지 생성·참여
8. **포인트샵 / 악세서리** — 할일 완료 XP가 포인트로 적립, 5종 고정 카탈로그에서 구매·장착, 꾸미에 악세서리 반영

### 백엔드 라우트

`auth`, `oauthGoogle`, `oauthKakao`, `users`, `goals`, `tasks`, `sessions`, `growth`, `history`, `friends`, `leaderboard`, `challenges`, `shop`, `activities`(레거시)

### 모바일 화면

`LoginScreen`, `SignupScreen`, `OnboardingChatScreen`, `HomeScreen`, `HistoryScreen`, `ProfileScreen`과 프로필 스택 하위의 `FriendsScreen`, `LeaderboardScreen`, `ChallengesScreen`, `ChallengeDetailScreen`, `ShopScreen`

## 테스트

전체 TDD로 진행했습니다 (백엔드 vitest, 모바일 jest). 서브프로젝트 8 완료 시점 기준:

- 백엔드: 171 tests / 22 files, 전부 통과
- 모바일: 123 tests, 전부 통과 (`HomeScreen.test.tsx`의 모달 타이밍 테스트 1건은 콜드 스타트 시 간헐적 타임아웃 — 알려진 플레이키, 재실행 시 항상 통과)

## 실행

### 백엔드

```
cd backend
npm install
npm run dev
```

로컬 PostgreSQL이 필요합니다 (`DATABASE_URL`). `.env.example` 참고 — `growme-postgres` Docker 컨테이너가 있다면 `docker start growme-postgres`로 기동하세요.

### 모바일 (Expo)

```
cd mobile
npm install
npx expo start
```

터미널에 뜨는 QR코드를 휴대폰 Expo Go 앱으로 스캔하면 실행됩니다. iOS 시뮬레이터/Android 에뮬레이터가 있다면 `npm run ios` / `npm run android`도 가능합니다.

## 상태

V2 React Native 피벗의 핵심 기능 범위(서브프로젝트 1~8) 구현 완료. 비주얼 디자인은 아직 미적용 상태이며, 다음 스코프는 별도 확인 후 진행합니다.
