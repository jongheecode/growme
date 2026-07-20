# 소셜(친구·랭킹·챌린지) 구현 계획 (Sub-project 7)

스펙: `docs/superpowers/specs/2026-07-20-social-friends-ranking-challenges-design.md`. worktree 없이 master에 직접 진행(서브프로젝트 4-6과 동일 패턴, [[feedback_unattended_execution]]).

## Task 1 — 스키마: Friendship/Challenge/ChallengeMember 추가

`backend/prisma/schema.prisma`에 `FriendStatus` enum, `Friendship`, `Challenge`, `ChallengeMember` 모델 추가(스펙의 데이터 모델 그대로) + `User`에 역방향 관계 4개 추가. `npx prisma db push` (dev DB) + `DATABASE_URL=".../growme_test" npx prisma db push --skip-generate` (test DB, `reference_growme_dev_env` 참고) + `npx prisma generate`. 커밋: "feat: Friendship/Challenge/ChallengeMember 스키마 추가"

## Task 2 — 백엔드: `friends.ts` 테스트(Red) → 구현(Green)

`backend/src/routes/friends.test.ts`: 요청 성공(201), 존재하지 않는 닉네임(404), 자기 자신(400), 중복 요청(409), `GET /requests`가 PENDING만 반환, 수락 후 상태 ACCEPTED, 타인이 수락 시도(404), `DELETE`로 거절/친구끊기 둘 다 동작, 얽히지 않은 유저의 삭제 시도(404), `GET /`가 ACCEPTED만 `{id,nickname,species,stage,totalXp}`로 반환(미hatch 유저는 `species: null, stage: 0`).

`backend/src/routes/friends.ts` (신규):
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';
import { getTotalXp, ensureHatched, getGrowthStageInfo } from '../services/growth';

const router = Router();

router.post('/request', requireAuth, async (req: AuthedRequest, res) => {
  const { nickname } = req.body;
  if (!isNonEmptyString(nickname)) return res.status(400).json({ error: 'nickname is required' });
  try {
    const target = await prisma.user.findFirst({ where: { nickname } });
    if (!target) return res.status(404).json({ error: 'user not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'cannot friend yourself' });

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: req.userId!, addresseeId: target.id },
          { requesterId: target.id, addresseeId: req.userId! },
        ],
      },
    });
    if (existing) return res.status(409).json({ error: 'friendship already exists' });

    const friendship = await prisma.friendship.create({
      data: { requesterId: req.userId!, addresseeId: target.id },
    });
    res.status(201).json({ id: friendship.id });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/requests', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: req.userId!, status: 'PENDING' },
      include: { requester: { select: { nickname: true } } },
    });
    res.json(requests.map((r) => ({ id: r.id, requesterId: r.requesterId, requesterNickname: r.requester.nickname })));
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/:id/accept', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendship = await prisma.friendship.findFirst({
      where: { id: req.params.id, addresseeId: req.userId!, status: 'PENDING' },
    });
    if (!friendship) return res.status(404).json({ error: 'request not found' });
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'ACCEPTED' } });
    res.json({ id: friendship.id, status: 'ACCEPTED' });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendship = await prisma.friendship.findFirst({
      where: { id: req.params.id, OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
    });
    if (!friendship) return res.status(404).json({ error: 'friendship not found' });
    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
      include: { requester: true, addressee: true },
    });
    const friends = await Promise.all(
      friendships.map(async (f) => {
        const other = f.requesterId === req.userId ? f.addressee : f.requester;
        const totalXp = await getTotalXp(other.id);
        const species = await ensureHatched(other.id, totalXp);
        const stage = species ? getGrowthStageInfo(species, totalXp).stage : 0;
        return { id: other.id, nickname: other.nickname, species, stage, totalXp };
      })
    );
    res.json(friends);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

`app.ts`에 `app.use('/api/friends', friendsRouter)` 추가. 실행 → 회귀 확인. 커밋: "feat: 친구 요청/수락/목록 API 추가"

## Task 3 — 백엔드: `leaderboard.ts` 테스트(Red) → 구현(Green)

`backend/src/routes/leaderboard.test.ts`: `scope=global`이 전체 유저 XP 내림차순+rank, `scope=friends`가 본인+수락된 친구만, `range=weekly`가 7일 이전 완료 태스크는 제외, `range=alltime`이 전체 합, 동점자 userId 오름차순, global 50명 캡(간단히 로직 존재만 확인하거나 스킵 가능 — 50명 생성은 과함, 정렬/필터 검증에 집중).

`backend/src/routes/leaderboard.ts` (신규):
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const scope = req.query.scope === 'friends' ? 'friends' : 'global';
    const range = req.query.range === 'weekly' ? 'weekly' : 'alltime';

    let userIds: string[] | undefined;
    if (scope === 'friends') {
      const friendships = await prisma.friendship.findMany({
        where: { status: 'ACCEPTED', OR: [{ requesterId: req.userId! }, { addresseeId: req.userId! }] },
      });
      userIds = [
        req.userId!,
        ...friendships.map((f) => (f.requesterId === req.userId ? f.addresseeId : f.requesterId)),
      ];
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const grouped = await prisma.task.groupBy({
      by: ['userId'],
      where: {
        status: 'COMPLETED',
        ...(userIds ? { userId: { in: userIds } } : {}),
        ...(range === 'weekly' ? { completedAt: { gte: since } } : {}),
      },
      _sum: { xpValue: true },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, nickname: true },
    });
    const nicknameById = new Map(users.map((u) => [u.id, u.nickname]));

    const entries = grouped
      .map((g) => ({ userId: g.userId, nickname: nicknameById.get(g.userId)!, totalXp: g._sum.xpValue ?? 0 }))
      .sort((a, b) => b.totalXp - a.totalXp || (a.userId < b.userId ? -1 : 1))
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    res.json(entries);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

주의: `scope=friends`인데 아직 완료 태스크가 없는 본인/친구는 `groupBy` 결과에 안 잡혀 리스트에서 빠짐 — 스펙엔 명시 안 됐지만 "XP 0인 사람도 순위에 넣을까"는 과설계 방지 차원에서 **빠지는 쪽으로 결정**(완료 이력이 있는 사람만 랭킹에 등장). `app.ts`에 마운트. 실행 → 회귀. 커밋: "feat: 친구/전체 랭킹 API 추가"

## Task 4 — 백엔드: `challenges.ts` 테스트(Red) → 구현(Green)

`backend/src/routes/challenges.test.ts`: 생성 시 생성자가 첫 멤버(201), `GET /mine`에 achievedXp/percent 포함, `GET /:id` 비멤버 404, `POST /join` 성공/중복409/잘못된코드404, `DELETE /:id/leave` 일반 멤버 성공/생성자 400/비멤버 404, `category` 필터가 다른 카테고리 완료 태스크를 achievedXp에서 제외.

`backend/src/routes/challenges.ts` (신규):
```ts
import { Router } from 'express';
import crypto from 'crypto';
import { Category } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { isNonEmptyString } from './auth';

const router = Router();

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

async function computeAchievedXp(userId: string, challenge: { startDate: Date; endDate: Date; category: Category | null }) {
  const result = await prisma.task.aggregate({
    where: {
      userId,
      status: 'COMPLETED',
      completedAt: { gte: challenge.startDate, lte: challenge.endDate },
      ...(challenge.category ? { category: challenge.category } : {}),
    },
    _sum: { xpValue: true },
  });
  return result._sum.xpValue ?? 0;
}

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { name, category, targetXp, startDate, endDate } = req.body;
  if (!isNonEmptyString(name) || typeof targetXp !== 'number' || !startDate || !endDate) {
    return res.status(400).json({ error: 'invalid challenge payload' });
  }
  if (category !== undefined && category !== null && !isCategory(category)) {
    return res.status(400).json({ error: 'invalid category' });
  }
  try {
    const inviteCode = crypto.randomBytes(4).toString('hex');
    const challenge = await prisma.challenge.create({
      data: {
        name,
        category: category ?? null,
        targetXp,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        inviteCode,
        createdById: req.userId!,
        members: { create: { userId: req.userId! } },
      },
    });
    res.status(201).json(challenge);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/mine', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const memberships = await prisma.challengeMember.findMany({
      where: { userId: req.userId! },
      include: { challenge: true },
    });
    const result = await Promise.all(
      memberships.map(async (m) => {
        const achievedXp = await computeAchievedXp(req.userId!, m.challenge);
        return {
          ...m.challenge,
          achievedXp,
          percent: m.challenge.targetXp > 0 ? (achievedXp / m.challenge.targetXp) * 100 : 0,
        };
      })
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const membership = await prisma.challengeMember.findFirst({
      where: { challengeId: req.params.id, userId: req.userId! },
    });
    if (!membership) return res.status(404).json({ error: 'challenge not found' });

    const challenge = await prisma.challenge.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { members: { include: { user: true } } },
    });

    const members = await Promise.all(
      challenge.members.map(async (m) => {
        const achievedXp = await computeAchievedXp(m.userId, challenge);
        return {
          userId: m.userId,
          nickname: m.user.nickname,
          achievedXp,
          percent: challenge.targetXp > 0 ? (achievedXp / challenge.targetXp) * 100 : 0,
        };
      })
    );
    members.sort((a, b) => b.achievedXp - a.achievedXp);

    res.json({
      id: challenge.id,
      name: challenge.name,
      category: challenge.category,
      targetXp: challenge.targetXp,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      inviteCode: challenge.inviteCode,
      createdById: challenge.createdById,
      members,
    });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/join', requireAuth, async (req: AuthedRequest, res) => {
  const { inviteCode } = req.body;
  if (!isNonEmptyString(inviteCode)) return res.status(400).json({ error: 'inviteCode is required' });
  try {
    const challenge = await prisma.challenge.findUnique({ where: { inviteCode } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });
    const existing = await prisma.challengeMember.findFirst({
      where: { challengeId: challenge.id, userId: req.userId! },
    });
    if (existing) return res.status(409).json({ error: 'already a member' });
    await prisma.challengeMember.create({ data: { challengeId: challenge.id, userId: req.userId! } });
    res.status(201).json({ id: challenge.id });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id/leave', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const challenge = await prisma.challenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });
    if (challenge.createdById === req.userId) {
      return res.status(400).json({ error: 'creator cannot leave the challenge' });
    }
    const membership = await prisma.challengeMember.findFirst({
      where: { challengeId: req.params.id, userId: req.userId! },
    });
    if (!membership) return res.status(404).json({ error: 'not a member' });
    await prisma.challengeMember.delete({ where: { id: membership.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```

`app.ts`에 마운트. 실행 → 회귀 + `tsc --noEmit`. 커밋: "feat: 챌린지 생성/참여/진행률 API 추가"

## Task 5 — 모바일: API 클라이언트 3종

`mobile/src/api/friends.ts`, `mobile/src/api/leaderboard.ts`, `mobile/src/api/challenges.ts` — 기존 `apiFetch` 패턴, 실패 시 한국어 에러 메시지. 타입은 백엔드 응답 형태 그대로. `tsc --noEmit`. 커밋: "feat: 친구/랭킹/챌린지 모바일 API 클라이언트 추가"

## Task 6 — 모바일: `ProfileStack` 네비게이션 + `ProfileScreen` 진입 버튼

`mobile/src/navigation/ProfileStack.tsx` (신규, `AuthStack.tsx` 패턴): `ProfileHome`/`Friends`/`Leaderboard`/`Challenges`/`ChallengeDetail`(파라미터 `{challengeId: string}`) 스크린 등록, `headerShown: true`(뒤로가기 필요). `MainTabs.tsx`의 Profile 탭 컴포넌트를 `ProfileScreen` → `ProfileStack`으로 교체. `ProfileScreen.tsx`에 버튼 3개(`testID`: `nav-friends`/`nav-leaderboard`/`nav-challenges`) 추가, `navigation.navigate(...)` 호출.
`RootNavigator.test.tsx`/`MainTabs` 관련 기존 테스트가 깨지지 않는지 확인(간접 렌더 스모크 테스트일 가능성 높음 — 실행해서 확인). 커밋: "feat: 프로필 탭에 소셜 화면 스택 연결"

## Task 7 — 모바일: `FriendsScreen`

테스트(Red): 목록 로드, 요청 보내기(입력+버튼), 받은 요청 수락, 에러+재시도. 구현(Green): 마운트 시 `GET /friends` + `GET /friends/requests` 병렬 로드, 요청 폼, 수락 버튼. `HomeScreen`의 로딩/에러 패턴 재사용. 커밋: "feat: 친구 화면 구현"

## Task 8 — 모바일: `LeaderboardScreen`

테스트(Red): 기본 로드(전체/전체기간), scope 토글 시 재조회(`scope=friends`), range 토글 시 재조회(`range=weekly`), 순위 리스트 렌더. 구현(Green). 커밋: "feat: 랭킹 화면 구현"

## Task 9 — 모바일: `ChallengesScreen` + `ChallengeDetailScreen`

테스트(Red, 두 파일): 내 챌린지 목록+진행률 표시, 생성 폼 제출, 초대코드 참여 입력, 항목 탭 시 상세로 이동(navigation mock); 상세 화면 멤버별 랭킹 렌더, 탈퇴 버튼(비생성자만 표시). 구현(Green). 커밋: "feat: 챌린지 목록/생성/참여/상세 화면 구현"

## Task 10 — 최종 회귀 + 메모리 업데이트

- `cd backend && npm test && npx tsc --noEmit`
- `cd mobile && npx jest && npx tsc --noEmit`
- 그린이면 memory(`project_v2_app_pivot.md`, `MEMORY.md`) 갱신, 다음은 8(포인트샵/꾸미기) 안내.
