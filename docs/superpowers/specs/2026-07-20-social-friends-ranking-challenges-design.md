# 소셜: 친구 · 랭킹 · 챌린지 (Sub-project 7, RN 재설계)

- 작성일: 2026-07-20
- 이 문서는 2026-07-16에 작성된 `2026-07-16-social-friends-ranking-challenges-design.md`(V1.5 웹 시절)를 대체한다. 브레인스토밍 대화형 질문 단계는 사용자의 명시적 지시(`/loop ... 아무것도 물어보지 말고 진행해`, [[feedback_unattended_execution]])에 따라 생략했고, 아래 결정은 옛 스펙의 아이디어를 현재(RN, XP 기반 성장) 아키텍처에 맞게 스스로 재해석한 것이다.

## 옛 스펙과의 차이 (왜 다시 썼는가)

옛 스펙은 V1의 `frontend/`(웹) 페이지 구조와 `Growth.currentGauge`/`Session.verifiedSeconds` 시간 누적 모델을 전제로 했다. 두 전제 모두 이후 폐기됐다:
- 프론트엔드는 `frontend/`가 아니라 `mobile/`(React Native, Expo) — 웹 페이지 경로는 전부 RN 화면/스택으로 대체.
- 서브프로젝트 2에서 "성장은 오직 태스크 완료로만"이 확정되며 `Growth.currentGauge`는 완전히 제거되고 `Task.xpValue` 합산(`getTotalXp`, `backend/src/services/growth.ts`)이 유일한 성장 지표가 됐다.

**따라서 랭킹과 챌린지 모두 시간(`Session.verifiedSeconds`) 대신 XP(완료한 태스크의 `xpValue` 합)를 기준으로 재설계한다.** 이렇게 하면: (1) 앱의 핵심 성장 지표와 소셜 경쟁 지표가 완전히 일치하고, (2) 서브프로젝트 5의 미션 타이머(선택 기능)를 쓰지 않는 유저도 챌린지/랭킹에 동등하게 참여할 수 있다. 친구/초대코드 메커니즘, 거절=row 삭제 등 옛 스펙의 관계형 설계 결정은 그대로 유지한다(여전히 유효).

## 데이터 모델

```prisma
enum FriendStatus {
  PENDING
  ACCEPTED
}

model Friendship {
  id          String       @id @default(uuid())
  requesterId String
  addresseeId String
  status      FriendStatus @default(PENDING)
  createdAt   DateTime     @default(now())
  requester   User @relation("FriendRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee   User @relation("FriendAddressee", fields: [addresseeId], references: [id], onDelete: Cascade)
  @@unique([requesterId, addresseeId])
}

model Challenge {
  id          String   @id @default(uuid())
  name        String
  category    Category?
  targetXp    Int
  startDate   DateTime
  endDate     DateTime
  inviteCode  String   @unique
  createdById String
  createdBy   User @relation(fields: [createdById], references: [id], onDelete: Cascade)
  members     ChallengeMember[]
}

model ChallengeMember {
  id          String   @id @default(uuid())
  challengeId String
  userId      String
  joinedAt    DateTime @default(now())
  challenge   Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([challengeId, userId])
}
```

거절(DECLINED)은 옛 스펙과 동일하게 별도 상태를 두지 않는다 — 거절/삭제 시 해당 `Friendship` row를 바로 지워 재요청이 가능하게 한다.

`User`에 역방향 관계 추가: `friendshipsSent Friendship[] @relation("FriendRequester")`, `friendshipsReceived Friendship[] @relation("FriendAddressee")`, `challengesCreated Challenge[]`, `challengeMemberships ChallengeMember[]`.

## 백엔드 API

### `src/routes/friends.ts` (`/api/friends`, requireAuth)
- `POST /request` `{nickname}` → 닉네임으로 유저 조회(최초 1명 매칭, 중복 닉네임 처리는 범위 밖), 대상 없으면 404, 자기 자신이면 400, 이미 관계(PENDING/ACCEPTED, 방향 무관) 있으면 409, 없으면 PENDING 생성(201)
- `GET /requests` → 내게 온 PENDING 목록, `{id, requesterId, requesterNickname}[]`
- `POST /:id/accept` → 본인이 addressee인 PENDING만 ACCEPTED로(그 외 404)
- `DELETE /:id` → 본인이 requester 또는 addressee인 row만 삭제 가능(거절/친구끊기 겸용), 아니면 404
- `GET /` → 본인이 얽힌 ACCEPTED만, 상대방 `{id, nickname, species, stage, totalXp}` — `species`/`stage`는 `getGrowthStageInfo`+`ensureHatched`(이미 hatch된 경우만, 강제 hatch는 하지 않음 — 미hatch면 `species: null, stage: 0`), `totalXp`는 `getTotalXp` 재사용

### `src/routes/leaderboard.ts` (`GET /api/leaderboard?scope=friends|global&range=weekly|alltime`, requireAuth)
- `scope=friends`: 본인 + ACCEPTED 친구 userId만
- `scope=global`: 전체 유저, 상위 50명 제한
- `range=weekly`: 최근 7일 내 `completedAt`을 가진 COMPLETED 태스크의 `xpValue` 합
- `range=alltime`: 전체 COMPLETED 태스크의 `xpValue` 합(=`getTotalXp`)
- 응답: `[{userId, nickname, totalXp, rank}]`, `totalXp` 내림차순, 동점자는 `userId` 오름차순 안정 정렬, `rank`는 1부터

### `src/routes/challenges.ts` (`/api/challenges`, requireAuth)
- `POST /` `{name, category?, targetXp, startDate, endDate}` → 생성자 자동 첫 멤버, `inviteCode`는 `crypto.randomBytes(4).toString('hex')`(8자)
- `GET /mine` → 내가 멤버인 챌린지 목록 + 각각 내 `achievedXp`(구간 내 COMPLETED 태스크 `xpValue` 합, `category` 지정 시 필터)와 `percent`(`achievedXp/targetXp*100`, 100 초과 허용 — 캡 안 함)
- `GET /:id` → 멤버만 조회 가능(아니면 404), 상세 + 멤버별 `{userId, nickname, achievedXp, percent}[]`(achievedXp 내림차순)
- `POST /join` `{inviteCode}` → 코드로 참여, 코드 없으면 404, 이미 멤버면 409
- `DELETE /:id/leave` → 본인 멤버십 삭제, 생성자는 탈퇴 불가(400), 멤버 아니면 404

## 모바일 구현

기존 화면들의 확립된 패턴을 따른다: `TaskSheet`처럼 리스트+폼이 있는 화면은 전체 화면(Modal 아님), 상세 보기(`ChallengeDetail`)는 네비게이션 스택으로 처리(`AuthStack.tsx`가 이미 쓰는 `@react-navigation/native-stack` 패턴 재사용). 확정된 하단 탭은 홈/히스토리/프로필 3개뿐(변경 없음) — 친구/랭킹/챌린지는 새 탭이 아니라 **프로필 탭 내부의 새 스택**으로 들어간다.

- `mobile/src/navigation/ProfileStack.tsx` (신규): `createNativeStackNavigator`, 화면: `ProfileHome`(기존 `ProfileScreen`), `Friends`, `Leaderboard`, `Challenges`, `ChallengeDetail`. `MainTabs.tsx`의 `Profile` 탭 컴포넌트를 `ProfileScreen`에서 `ProfileStack`으로 교체.
- `mobile/src/screens/ProfileScreen.tsx`: "친구"/"랭킹"/"챌린지" 버튼 3개 추가(`navigation.navigate(...)`), 기존 목표추가/로그아웃 버튼 유지.
- `mobile/src/api/friends.ts`, `leaderboard.ts`, `challenges.ts` (신규 API 클라이언트, 기존 `apiFetch` 패턴).
- `mobile/src/screens/FriendsScreen.tsx`: 닉네임 입력+요청 버튼, 받은 요청 목록(수락/거절), 친구 목록(닉네임+stage+totalXp 미니 카드).
- `mobile/src/screens/LeaderboardScreen.tsx`: scope(친구/전체)·range(주간/전체) 토글, 순위 리스트.
- `mobile/src/screens/ChallengesScreen.tsx`: 내 챌린지 목록(진행률 텍스트/바), 새 챌린지 생성 폼, 초대코드로 참여 입력란, 각 챌린지 항목 탭 시 `ChallengeDetail`로 이동.
- `mobile/src/screens/ChallengeDetailScreen.tsx`: 멤버별 진행률 랭킹, 초대코드 표시, 탈퇴 버튼(생성자면 숨김).

## 테스트 전략

백엔드: `friends.test.ts`(요청/수락/거절/중복409/자기자신400/목록), `leaderboard.test.ts`(scope·range 조합별 정렬·필터·rank), `challenges.test.ts`(생성/참여/중복참여409/진행률 계산/생성자 탈퇴 불가/비멤버 조회 불가). 모바일: 각 화면 렌더+주요 상호작용(요청 보내기, 수락, scope 전환, 챌린지 생성, 참여, 상세 진입) — 기존 `HomeScreen.test.tsx`/`TaskSheet.test.tsx`의 mock 패턴 재사용.

## 범위 밖 (옛 스펙과 동일하게 유지)
- 댓글/좋아요/피드
- 챌린지 삭제, 챌린지 알림
- 닉네임 중복 처리(이메일 기반 검색으로의 개선은 후속)
