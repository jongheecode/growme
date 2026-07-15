# 소셜: 친구 · 랭킹 · 그룹 챌린지

## 배경

경쟁/동기부여 요소로 친구 추가, 랭킹, 그룹 챌린지를 추가한다. 채팅·댓글·좋아요 등 SNS형 피드는 이번 범위에 포함하지 않는다(사용자가 "그룹 챌린지, 친구/랭킹"을 명시적으로 선택).

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
  requester   User @relation("FriendRequester", fields: [requesterId], references: [id])
  addressee   User @relation("FriendAddressee", fields: [addresseeId], references: [id])
  @@unique([requesterId, addresseeId])
}

model Challenge {
  id            String   @id @default(uuid())
  name          String
  category      Category?
  targetSeconds Int
  startDate     DateTime
  endDate       DateTime
  inviteCode    String   @unique
  createdById   String
  createdBy     User @relation(fields: [createdById], references: [id])
  members       ChallengeMember[]
}

model ChallengeMember {
  id          String   @id @default(uuid())
  challengeId String
  userId      String
  joinedAt    DateTime @default(now())
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  user        User @relation(fields: [userId], references: [id])
  @@unique([challengeId, userId])
}
```

거절(DECLINED)은 별도 상태로 남기지 않는다 — 거절 시 해당 `Friendship` row를 바로 삭제해 재요청이 가능하게 한다(상태 enum을 PENDING/ACCEPTED 둘로 단순화).

`User`에 역방향 관계(`friendshipsSent`, `friendshipsReceived`, `challengesCreated`, `challengeMemberships`) 추가.

## 백엔드 API

`src/routes/friends.ts` (`/api/friends`, requireAuth):
- `POST /api/friends/request` `{nickname}` → 닉네임으로 대상 유저 조회(중복 닉네임 가능성은 이번 범위에서 무시 — 최초 1명 매칭, 이후 이메일 기반 검색은 범위 밖), 이미 요청/수락 상태면 409, 자기 자신 요청이면 400.
- `GET /api/friends/requests` → 내게 온 PENDING 목록
- `POST /api/friends/:id/accept` → status를 ACCEPTED로
- `DELETE /api/friends/:id` → 거절 또는 친구 삭제(둘 다 row 삭제, 요청자/수신자 어느 쪽이든 본인이 얽힌 관계만 삭제 가능하도록 검증)
- `GET /api/friends` → ACCEPTED 목록, 각 친구의 `{id, nickname, stage, currentGauge}`(친구의 Growth 조인)까지 포함해 프론트에서 바로 미니 카드로 렌더 가능하게

`src/routes/leaderboard.ts` (`GET /api/leaderboard?scope=friends|global&range=weekly|alltime`, requireAuth):
- `scope=friends`: 본인 + ACCEPTED 친구들의 `userId` 목록으로 필터
- `scope=global`: 필터 없음(상위 50명 제한)
- `range=weekly`: 최근 7일 `Session.verifiedSeconds` 합, `range=alltime`: 전체 합(`Growth.currentGauge` 재사용 가능하나 스코프가 friends/global 섞이므로 `Session` 합산으로 통일해 일관성 유지)
- 응답: `[{userId, nickname, totalSeconds, rank}]`, `rank`는 `totalSeconds` 내림차순 1부터 부여, 동점자는 `userId` 오름차순으로 안정 정렬

`src/routes/challenges.ts` (`/api/challenges`, requireAuth):
- `POST /api/challenges` `{name, category?, targetSeconds, startDate, endDate}` → 생성자 자동으로 첫 멤버 등록, `inviteCode`는 8자 랜덤 문자열(`crypto.randomBytes`)
- `GET /api/challenges/mine` → 내가 속한 챌린지 목록 + 각 챌린지의 내 진행률
- `GET /api/challenges/:id` → 상세 + 멤버별 진행률(`{userId, nickname, achievedSeconds, percent}[]`, `achievedSeconds`는 `startDate~endDate` 구간 `Session.verifiedSeconds` 합, `category` 지정 시 해당 카테고리만)
- `POST /api/challenges/join` `{inviteCode}` → 코드로 참여, 이미 멤버면 409
- `DELETE /api/challenges/:id/leave` → 탈퇴(생성자는 탈퇴 불가, 대신 챌린지 자체를 삭제하는 별도 엔드포인트는 이번 범위 밖 — 생성자는 그대로 유지, 방치된 챌린지는 `endDate` 지나면 자연 종료로 간주)

## 프론트엔드

- `frontend/src/pages/FriendsPage.tsx` (`/friends`): 닉네임으로 친구 추가, 받은 요청 목록(수락/거절 버튼), 친구 목록(미니 카드: 닉네임, 단계, 누적시간)
- `frontend/src/pages/LeaderboardPage.tsx` (`/leaderboard`): scope(친구/전체) · range(주간/전체) 토글, 순위 리스트(1~3위는 강조 스타일)
- `frontend/src/pages/ChallengesPage.tsx` (`/challenges`): 내 챌린지 목록(진행률 바), 새 챌린지 만들기 폼, 초대코드로 참여하기
- `frontend/src/pages/ChallengeDetailPage.tsx` (`/challenges/:id`): 멤버별 진행률 바 랭킹, 초대코드 공유(복사 버튼)
- `Layout.tsx` nav에 "친구"·"랭킹"·"챌린지" 추가(V1.5의 프로필 링크와 함께 — nav 항목이 많아지므로 데스크톱은 가로 나열 유지, 모바일은 축약 필요 여부는 구현 중 판단)

## 테스트
백엔드: `friends.test.ts`(요청/수락/거절/목록), `leaderboard.test.ts`(scope·range별 정렬/필터), `challenges.test.ts`(생성/참여/진행률 계산). 프론트: 각 페이지 렌더+상호작용 스모크 테스트.

## 범위 밖
- 댓글/좋아요/피드
- 챌린지 삭제, 챌린지 알림
- 닉네임 중복 처리(친구 검색을 이메일 기반으로 바꾸는 개선은 후속)
