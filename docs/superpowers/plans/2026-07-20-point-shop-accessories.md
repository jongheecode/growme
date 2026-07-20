# 포인트 상점 & 꾸미 악세서리 구현 계획 (Sub-project 8)

스펙: `docs/superpowers/specs/2026-07-20-point-shop-accessories-design.md`. worktree 없이 master에 직접 진행(서브프로젝트 4-7과 동일 패턴, [[feedback_unattended_execution]]).

## Task 1 — 스키마: AccessoryItem/UserAccessory + GrowthProfile.points

`backend/prisma/schema.prisma`: `AccessorySlot` enum(HAT/FACE/BACKGROUND), `AccessoryItem`, `UserAccessory` 모델 추가 + `GrowthProfile`에 `points Int @default(0)` 추가 + `User`에 `userAccessories UserAccessory[]` 역방향 관계 추가. `npx prisma db push` + `npx prisma generate`(test DB는 `tests/setup.ts`가 자동 push). 커밋: "feat: AccessoryItem/UserAccessory 스키마 + 포인트 필드 추가"

## Task 2 — 백엔드: 태스크 완료 시 포인트 적립 (TDD)

`backend/src/routes/tasks.test.ts`에 케이스 추가: 태스크 완료 시 `GrowthProfile.points`가 `xpValue`만큼 증가(완료 전 GrowthProfile이 없는 유저도 정상 동작 — upsert). `backend/src/routes/tasks.ts`의 `PATCH /:id/complete` 핸들러에서 `status: 'COMPLETED'`로 업데이트한 직후 추가:
```ts
await prisma.growthProfile.upsert({
  where: { userId: req.userId! },
  create: { userId: req.userId!, points: task.xpValue },
  update: { points: { increment: task.xpValue } },
});
```
실행 → 회귀 + tsc. 커밋: "feat: 태스크 완료 시 포인트 적립"

## Task 3 — 백엔드: `GET /api/growth/me`에 `points` 포함 (TDD)

`backend/src/routes/growth.test.ts`에 케이스 추가(포인트 적립 후 `points` 필드 반영, 신규 유저는 `points: 0`). `backend/src/routes/growth.ts`에서 `ensureHatched` 호출 전후로 `GrowthProfile`을 조회(또는 `ensureHatched`가 이미 upsert하니 그 반환값에 `points`가 없다면 별도 조회)해 응답에 `points` 추가. 실행 → 회귀 + tsc. 커밋: "feat: growth/me 응답에 포인트 잔액 포함"

## Task 4 — 백엔드: `shop.ts` 테스트(Red) → 구현(Green)

`backend/src/routes/shop.test.ts`: `GET /items`가 5종 반환 + 재호출해도 중복 생성 안 됨(count 확인), 미보유 아이템 `owned: false`/보유 아이템 `owned: true`, 구매 성공 시 포인트 차감 + `UserAccessory` 생성, 포인트 부족 400, 중복 구매 409, 장착 시 같은 슬롯 자동 해제, 미보유 장착 시도 404, `GET /my-accessories`가 장착 중인 것만 반환.

`backend/src/routes/shop.ts` (신규):
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const CATALOG = [
  { key: 'ribbon', name: '리본', slot: 'HAT' as const, price: 50 },
  { key: 'crown', name: '왕관', slot: 'HAT' as const, price: 200 },
  { key: 'round_glasses', name: '동그란 안경', slot: 'FACE' as const, price: 80 },
  { key: 'star_bg', name: '별 배경', slot: 'BACKGROUND' as const, price: 120 },
  { key: 'rainbow_bg', name: '무지개 배경', slot: 'BACKGROUND' as const, price: 300 },
];

async function ensureCatalog() {
  await Promise.all(
    CATALOG.map((item) =>
      prisma.accessoryItem.upsert({
        where: { key: item.key },
        create: item,
        update: {},
      })
    )
  );
}

router.get('/items', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await ensureCatalog();
    const items = await prisma.accessoryItem.findMany({
      include: { userAccessories: { where: { userId: req.userId! } } },
    });
    res.json(
      items.map((item) => ({
        id: item.id,
        key: item.key,
        name: item.name,
        slot: item.slot,
        price: item.price,
        owned: item.userAccessories.length > 0,
      }))
    );
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/purchase', requireAuth, async (req: AuthedRequest, res) => {
  const { itemId } = req.body;
  try {
    const item = await prisma.accessoryItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'item not found' });

    const existing = await prisma.userAccessory.findUnique({
      where: { userId_itemId: { userId: req.userId!, itemId } },
    });
    if (existing) return res.status(409).json({ error: 'already owned' });

    const profile = await prisma.growthProfile.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId! },
      update: {},
    });
    if (profile.points < item.price) {
      return res.status(400).json({ error: 'not enough points' });
    }

    await prisma.$transaction([
      prisma.userAccessory.create({ data: { userId: req.userId!, itemId } }),
      prisma.growthProfile.update({
        where: { userId: req.userId! },
        data: { points: { decrement: item.price } },
      }),
    ]);
    res.status(201).json({ itemId });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.patch('/equip', requireAuth, async (req: AuthedRequest, res) => {
  const { itemId, equipped } = req.body;
  try {
    const owned = await prisma.userAccessory.findUnique({
      where: { userId_itemId: { userId: req.userId!, itemId } },
      include: { item: true },
    });
    if (!owned) return res.status(404).json({ error: 'item not owned' });

    if (equipped) {
      const sameSlotOwned = await prisma.userAccessory.findMany({
        where: { userId: req.userId!, equipped: true, item: { slot: owned.item.slot } },
      });
      await Promise.all(
        sameSlotOwned.map((ua) =>
          prisma.userAccessory.update({ where: { id: ua.id }, data: { equipped: false } })
        )
      );
    }
    const updated = await prisma.userAccessory.update({ where: { id: owned.id }, data: { equipped: !!equipped } });
    res.json({ itemId: updated.itemId, equipped: updated.equipped });
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/my-accessories', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const equipped = await prisma.userAccessory.findMany({
      where: { userId: req.userId!, equipped: true },
      include: { item: true },
    });
    res.json(equipped.map((ua) => ({ itemId: ua.itemId, slot: ua.item.slot, key: ua.item.key })));
  } catch {
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
```
`app.ts`에 `app.use('/api/shop', shopRouter)` 추가. 실행 → 회귀 + tsc. 커밋: "feat: 포인트 상점 구매/장착 API 추가"

## Task 5 — 모바일: API 클라이언트 (`shop.ts`) + `growth.ts` 확장

`mobile/src/api/shop.ts` (신규): `ShopItem`, `getShopItems()`, `purchaseItem(itemId)`, `equipItem(itemId, equipped)`, `getMyAccessories()`. `mobile/src/api/growth.ts`의 `GrowthState`에 `points: number` 추가. `tsc --noEmit`. 커밋: "feat: 모바일 상점 API 클라이언트 추가"

## Task 6 — 모바일: `ProfileStack`에 `Shop` 연결

`ProfileStackParamList`에 `Shop: undefined` 추가, `Stack.Screen name="Shop"` 등록. `ProfileScreen.tsx`에 "상점" 버튼(`nav-shop`) 추가 + `ProfileScreen.test.tsx`에 네비게이션 케이스 추가(기존 3개 버튼 테스트와 동일 패턴). 커밋: "feat: 프로필 탭에 상점 화면 연결"

## Task 7 — 모바일: `ShopScreen` (TDD)

테스트(Red): 목록+포인트 잔액 로드, 구매 버튼 클릭 → `purchaseItem` 호출 후 재조회, 장착/해제 버튼(보유 아이템만 표시) → `equipItem` 호출, 에러+재시도. 구현(Green): `HomeScreen`의 로딩/에러 패턴 재사용. 커밋: "feat: 상점 화면 구현"

## Task 8 — 모바일: `KkumiView` 악세서리 렌더링 (TDD, 기존 테스트 확장)

`KkumiView.test.tsx`에 케이스 추가: `accessories` prop으로 넘긴 슬롯마다 플레이스홀더 뱃지 렌더(`testID: accessory-badge-{slot}`), `stage 0`이면 `accessories`를 넘겨도 렌더 안 함. `KkumiView.tsx`에 `accessories?: { slot: 'HAT' | 'FACE' | 'BACKGROUND' }[]` prop 추가, `stage > 0 && accessories`일 때만 슬롯별 작은 `View`(플레이스홀더 색상 배지) 오버레이. 커밋: "feat: KkumiView에 악세서리 플레이스홀더 렌더링 추가"

## Task 9 — 모바일: `HomeScreen` 연동 (TDD)

`HomeScreen.test.tsx`에 케이스 추가: `getMyAccessories` mock이 반환한 항목이 `KkumiView`에 전달되는지(예: `accessory-badge-HAT` 렌더 확인). `HomeScreen.tsx`에서 마운트 시 `getMyAccessories()` 호출 → state → `KkumiView accessories={...}`로 전달. 커밋: "feat: 홈 화면에 장착 악세서리 연동"

## Task 10 — 최종 회귀 + 메모리 업데이트

- `cd backend && npm test && npx tsc --noEmit`
- `cd mobile && npx jest && npx tsc --noEmit`
- 그린이면 memory(`project_v2_app_pivot.md`, `MEMORY.md`) 갱신 — 이 서브프로젝트가 확정된 8개 서브프로젝트 시퀀스의 마지막이므로, "V2 앱 전환 피벗 8/8 완료" 상태로 기록.
