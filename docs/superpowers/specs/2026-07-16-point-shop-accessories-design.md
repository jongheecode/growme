# 포인트 상점 & 꾸미 악세서리

## 배경

인증 시간으로 포인트를 벌고, 포인트로 꾸미를 꾸며주는 악세서리(모자/안경/배경 등)를 구매하는 기능. 사용자가 명시한 대로 "프로필 훈장/한줄소개"는 미션 달성으로 얻는 것이지 구매 대상이 아니다 — 그건 V2 뱃지 시스템(`2026-07-15-v2-engagement-features-design.md`)과 V1.5 프로필 bio 필드로 이미 다룬다. 이 문서는 포인트로 사고 장착하는 **꾸미 외형 악세서리**만 다룬다.

## 데이터 모델

```prisma
enum AccessorySlot {
  HAT
  FACE
  BACKGROUND
}

model AccessoryItem {
  id    String @id @default(uuid())
  key   String @unique
  name  String
  slot  AccessorySlot
  price Int
  userAccessories UserAccessory[]
}

model UserAccessory {
  id          String   @id @default(uuid())
  userId      String
  itemId      String
  purchasedAt DateTime @default(now())
  equipped    Boolean  @default(false)
  user        User @relation(fields: [userId], references: [id])
  item        AccessoryItem @relation(fields: [itemId], references: [id])
  @@unique([userId, itemId])
}
```

`Growth`에 `points Int @default(0)` 추가 — 포인트 잔액(누적 게이지와 별개로, 구매로 소모됨).

**포인트 적립**: `src/services/growth.ts`의 `applySessionToGrowth`에서 gauge 갱신과 같은 지점에서 `points += Math.floor(verifiedSeconds / 60)`(분당 1포인트)로 적립. 소모(구매)만 차감하고 별도의 포인트 초기화/퇴화는 없음(gauge의 퇴화 로직과 분리).

## 백엔드 API

`src/routes/shop.ts` (`/api/shop`, requireAuth):
- `GET /api/shop/items` → 전체 `AccessoryItem` 목록 + 내가 보유한 아이템은 `owned: true` 플래그 포함(로그인 유저 기준 `UserAccessory` 조인)
- `POST /api/shop/purchase` `{itemId}` → 트랜잭션으로: `Growth.points >= item.price` 확인 → 부족하면 400 → `UserAccessory` 생성 + `Growth.points` 차감. 이미 보유 중이면 409.
- `PATCH /api/shop/equip` `{itemId, equipped}` → `equipped: true`로 설정 시 같은 `slot`의 기존 장착 아이템을 자동 해제(슬롯당 1개만 장착), `equipped: false`는 단순 해제. 미보유 아이템이면 404.
- `GET /api/shop/my-accessories` → 내가 보유+장착 중인 아이템 목록 (홈 화면에서 캐릭터 렌더링 시 사용)

**초기 아이템 카탈로그** (seed): 리본(HAT, 50P), 왕관(HAT, 200P), 동그란 안경(FACE, 80P), 별 배경(BACKGROUND, 120P), 무지개 배경(BACKGROUND, 300P) — 5종으로 시작.

## 프론트엔드

`frontend/src/pages/ShopPage.tsx` (`/shop`): 슬롯별로 그룹화된 아이템 그리드, 각 카드에 이름/가격/보유여부/장착 버튼. 상단에 현재 포인트 잔액 표시(`GET /api/growth/me` 응답에 `points` 필드 추가 필요 — `GrowthState` 타입 확장).

`frontend/src/components/KkumiCharacter.tsx` 확장: 기존 `{stage, category}` props에 `accessories?: {slot: AccessorySlot; imageKey: string}[]`를 추가로 받아, 각 슬롯 SVG를 캐릭터 위에 레이어로 겹쳐 그린다. 슬롯별 위치는 캐릭터 stage마다 다르므로(알 단계엔 모자가 어색함 등) `stage >= 1`(부화 이후)부터만 악세서리를 렌더한다. 5종 아이템 각각에 대응하는 작은 SVG를 `frontend/src/components/icons/accessories/` 아래 추가.

`HomePage.tsx`에서 `getMyAccessories()`(신규 API 클라이언트)로 장착 중인 악세서리를 가져와 `KkumiCharacter`에 전달.

`Layout.tsx` nav에 "상점" 추가.

## 테스트
백엔드: `shop.test.ts` — 구매 성공/포인트 부족/중복 구매, 장착 시 같은 슬롯 자동 해제. `growth.test.ts`에 포인트 적립 케이스 추가. 프론트: `ShopPage.test.tsx`(구매/장착 상호작용), `KkumiCharacter.test.tsx`(신규 — 악세서리 레이어 렌더 확인, 지금까지 이 컴포넌트엔 테스트가 없었으므로 이번에 추가).

## 범위 밖
- 포인트 환불/거래
- 악세서리 슬롯 확장(신발/손 아이템 등) — 5종 3슬롯으로 시작
- 알 단계(`stage 0`)에서의 악세서리 표시
