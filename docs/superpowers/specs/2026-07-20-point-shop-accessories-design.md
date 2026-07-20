# 포인트 상점 & 꾸미 악세서리 (Sub-project 8, RN 재설계)

- 작성일: 2026-07-20
- 이 문서는 2026-07-16에 작성된 `2026-07-16-point-shop-accessories-design.md`(V1.5 웹 시절)를 대체한다. 브레인스토밍 대화형 질문 단계는 사용자의 명시적 지시(`/loop ... 아무것도 물어보지 말고 진행해`, [[feedback_unattended_execution]])에 따라 생략했고, 아래 결정은 옛 스펙의 아이디어를 현재(RN, XP 기반 성장) 아키텍처에 맞게 스스로 재해석한 것이다.

## 옛 스펙과의 차이 (왜 다시 썼는가)

옛 스펙은 V1의 `frontend/`(웹) 구조와, 폐기된 `Growth.currentGauge`/시간 누적 모델(`applySessionToGrowth`)을 전제로 "분당 1포인트" 적립을 설계했다. 두 전제 모두 더 이상 없다:
- 프론트엔드는 `mobile/`(RN) — 웹 페이지 경로는 RN 화면으로 대체.
- 서브프로젝트 2에서 "성장은 오직 태스크 완료로만" 확정, 서브프로젝트 7에서 랭킹/챌린지도 시간 대신 XP 기준으로 재설계함 — **포인트 적립도 같은 원칙을 따라야 일관성이 유지된다.**

**따라서 포인트는 시간이 아니라 "태스크 완료"에서 나온다.** 태스크를 완료할 때마다 그 태스크의 `xpValue`만큼 포인트를 적립한다(XP와 별개의 소모형 잔액). 이렇게 하면: (1) 성장(XP, 영구/누적)과 상점 재화(포인트, 소모 가능)가 같은 사건(완료)에서 나오되 서로 다른 저장 방식(계산 vs 잔액)으로 완전히 분리되고, (2) 미션 타이머(선택 기능)를 쓰지 않아도 상점 이용에 지장이 없다.

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
  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)
  item        AccessoryItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  @@unique([userId, itemId])
}
```

`GrowthProfile`에 `points Int @default(0)` 추가 — XP(`getTotalXp`, 완료 이력에서 매번 재계산하는 값)와 달리, 포인트는 **적립/차감되는 실제 잔액**이라 별도 필드로 저장해야 한다(구매로 소모되면 이력에서 역산 불가능하기 때문).

**포인트 적립**: `PATCH /api/tasks/:id/complete`에서 태스크를 COMPLETED로 바꾸는 시점에 `GrowthProfile.points`를 `task.xpValue`만큼 `upsert`로 증가시킨다(GrowthProfile이 아직 없으면 생성 — `ensureHatched`와 같은 upsert 패턴). 소모(구매)만 차감하고 시간에 따른 초기화/퇴화는 없음.

**아이템 카탈로그 시딩**: 별도 seed 스크립트/마이그레이션 명령을 추가하지 않는다(개인 프로젝트에서 "매번 기억해서 실행해야 하는 명령"을 늘리는 건 과설계) — 대신 `GET /api/shop/items`가 호출될 때마다 고정 5종 아이템을 `key` 기준 `upsert`로 보장하는 **읽기 시점 보장(ensure-on-read)** 패턴을 쓴다(`ensureHatched`와 동일한 기존 관례). 초기 카탈로그: 리본(HAT, 50P), 왕관(HAT, 200P), 동그란 안경(FACE, 80P), 별 배경(BACKGROUND, 120P), 무지개 배경(BACKGROUND, 300P).

## 백엔드 API

### `src/routes/shop.ts` (`/api/shop`, requireAuth)
- `GET /items` → 카탈로그 5종 ensure 후 전체 반환, 각 아이템에 `owned: boolean`(내 `UserAccessory` 존재 여부) 포함
- `POST /purchase` `{itemId}` → 트랜잭션: `GrowthProfile.points >= item.price` 확인(부족하면 400) → 이미 보유 중이면 409 → `UserAccessory` 생성 + `points` 차감
- `PATCH /equip` `{itemId, equipped}` → `equipped: true`면 같은 `slot`의 기존 장착 아이템을 먼저 `equipped: false`로 자동 해제(슬롯당 1개), 미보유 아이템이면 404
- `GET /my-accessories` → 내가 장착 중인(`equipped: true`) 아이템만 반환(홈 화면 캐릭터 렌더링용)

### `GET /api/growth/me` 확장
- 응답에 `points: number` 필드 추가(`GrowthProfile.points`, 없으면 0) — `GrowthState` 타입 확장.

## 모바일 구현

확정된 하단 탭(홈/히스토리/프로필) 유지 원칙에 따라 새 탭을 추가하지 않고, 서브프로젝트 7에서 만든 **`ProfileStack`에 `Shop` 화면을 추가**한다(같은 패턴 반복 — 새 스택을 또 만들지 않음).

- `mobile/src/api/shop.ts` (신규): `ShopItem`(`{id, key, name, slot, price, owned}`), `getShopItems()`, `purchaseItem(itemId)`, `equipItem(itemId, equipped)`, `getMyAccessories()`.
- `mobile/src/api/growth.ts`: `GrowthState`에 `points: number` 추가.
- `ProfileStack.tsx`: `Shop` 화면 추가(`ProfileStackParamList`에 `Shop: undefined`). `ProfileScreen.tsx`에 "상점" 버튼(`nav-shop`) 추가.
- `mobile/src/screens/ShopScreen.tsx` (신규): 상단에 보유 포인트(`GET /api/growth/me`의 `points`) 표시, 슬롯별로 그룹화된 아이템 목록(이름/가격/보유여부/구매 또는 장착·해제 버튼).
- `mobile/src/components/KkumiView.tsx` 확장: 기존 `{species, stage}` props에 `accessories?: {slot: AccessorySlot}[]`를 추가로 받아, 슬롯별 자리에 작은 플레이스홀더(색이 있는 원/사각형 뱃지 — 실제 아이콘/SVG는 [[feedback_design_workflow]]에 따라 사용자가 나중에 별도로 완성)를 겹쳐 그린다. `stage 0`(알 단계)에서는 악세서리를 렌더하지 않는다(옛 스펙 결정 유지 — 알에 모자는 어색함).
- `mobile/src/screens/HomeScreen.tsx`: `getMyAccessories()`로 장착 중인 악세서리를 가져와 `KkumiView`에 전달.

## 테스트 전략

백엔드: `shop.test.ts`(카탈로그 ensure-on-read로 중복 생성 안 됨, 구매 성공/포인트부족400/중복구매409, 장착 시 같은 슬롯 자동 해제, 미보유 장착 시도 404), `tasks.test.ts`에 완료 시 포인트 적립 케이스 추가, `growth.test.ts`에 `points` 필드 포함 케이스 추가. 모바일: `ShopScreen.test.tsx`(목록 로드/구매/장착/해제), 기존 `KkumiView.test.tsx`(이미 2개 테스트 존재)에 악세서리 렌더링·`stage 0`일 때 미표시 케이스 추가, `HomeScreen.test.tsx`에 장착 악세서리 연동 케이스 추가.

## 범위 밖 (옛 스펙과 동일하게 유지)
- 포인트 환불/거래
- 악세서리 슬롯 확장(신발/손 아이템 등) — 5종 3슬롯으로 시작
- 알 단계(`stage 0`)에서의 악세서리 표시
