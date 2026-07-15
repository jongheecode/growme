# V1: UI 디자인 시스템 & 전 페이지 적용

## 배경

`frontend/src/index.css`에 Tailwind v4 기반 커스텀 테마(크림/코랄/민트/허니 팔레트)가 이미 도입되어 있고, 모든 페이지가 Tailwind 유틸리티 클래스로 리스타일링된 상태다 (커밋 전, 테스트는 전부 통과). 다만 전반적으로 기본 이모지(🔥🏅▶)와 여백 위주의 단조로운 레이아웃이라 "밋밋하고 비어 보인다"는 피드백을 받았다.

브라우저 기반 시각적 브레인스토밍(`.superpowers/brainstorm/`)을 통해 홈 화면 스탯 배지 영역을 여러 차례 반복해 다음 방향으로 확정했다: 밝고 정돈된 카드(옵션 B) + 레벨/스트릭 같은 게임적 성취 요소(옵션 C), Do Hyeon 폰트로 포인트를 주고, 이모지 대신 대칭형 커스텀 SVG 아이콘(번개/시계/별)을 흰 배지 카드에 얹는 스타일.

이 문서는 그 확정된 방향을 프로젝트 전체 페이지에 일관되게 적용하는 범위를 정의한다. **신규 백엔드 기능은 포함하지 않는다** — 스트릭/뱃지 등은 지금 화면에 정적 목업 값으로만 존재하며, 실 데이터 연동은 V2(`2026-07-15-v2-engagement-features-design.md`)에서 다룬다.

## 목표

- 전 페이지(로그인/활동선택/타이머/홈/히스토리)에 동일한 디자인 언어 적용
- 이모지를 커스텀 SVG 아이콘으로 전면 교체
- 포인트 타이포그래피(Do Hyeon) 도입
- 타이머 화면에 원형 진행 시각화 추가 (현재는 숫자 텍스트뿐)
- 기존 기능 동작·테스트는 변경하지 않음 (순수 UI 레이어 작업)

## 디자인 토큰

`frontend/src/index.css`의 `@theme`에 추가:

```css
--font-display: 'Do Hyeon', 'Pretendard', sans-serif;
```

`index.html`(또는 `main.tsx`에서 동적 삽입 대신) `<head>`에 Google Fonts 링크 추가:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap" rel="stylesheet">
```

**적용 규칙**: 본문/라벨/버튼 보조 텍스트는 계속 Pretendard(`font-sans`, 기본값 유지). `font-display`(Do Hyeon)는 페이지 제목, 캐릭터 이름/단계, 통계 숫자, 주요 CTA 버튼 텍스트에만 적용한다. 셋 다 본문용으로 쓰면 가독성이 떨어진다는 걸 브레인스토밍에서 확인했다.

## 아이콘 시스템

새 컴포넌트 `frontend/src/components/icons/` 아래 SVG React 컴포넌트 3개를 추가한다 (브레인스토밍에서 검증된 대칭 도형 그대로 이식):

- `BoltIcon` — 연속일/스트릭용. `viewBox="0 0 24 24"`, `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`
- `ClockIcon` — 누적 시간용. `viewBox="0 0 24 24"`, `<circle cx="12" cy="12" r="9.5" fill="none" stroke-width="2"/>` + `<path d="M12 7v5l3.2 2" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
- `StarIcon` — 뱃지/업적용. `viewBox="0 0 24 24"`, `<path d="M12 2 14.47 8.60 21.51 8.91 15.99 13.30 17.88 20.09 12 16.2 6.12 20.09 8.01 13.30 2.49 8.91 9.53 8.60 Z"/>`

세 아이콘 모두 `fill` 또는 `stroke` 색상을 prop으로 받아 `StatBadge`의 `tint`에 맞춰 렌더링한다(예: 연속일=coral-dark, 누적=mint-dark, 뱃지=honey 계열 `#c98a00`).

공통 배지 컴포넌트 `StatBadge`를 만들어 `{icon, value, label, tint}`를 받아 렌더링한다 (흰 배경 카드 + 진한 색 아이콘 + 컬러 그림자, `icon-choice-v2.html`의 "흰 배경 + 진한 아이콘" 안). 홈·히스토리 등 스탯을 보여주는 모든 곳에서 이 컴포넌트를 재사용한다.

이모지는 코드베이스에서 전부 제거한다 (헤더의 🌱만 브랜드 심볼로 유지할지는 로그인/헤더 절에서 별도 결정).

## 페이지별 변경

### LoginPage
현재 완전히 흰 카드 + 이모지 하나(🌱)뿐이라 가장 비어 보이는 화면. 브랜드 타이틀에 `font-display` 적용, 로그인 카드 상단의 🌱는 `KkumiCharacter`의 알(egg) 단계 SVG로 교체해 캐릭터 세계관과 첫 화면부터 연결한다. 배경에 옅은 블롭/그라데이션 장식 추가. `Layout` 헤더의 🌱(`🌱 그로우미` 로고 옆)는 텍스트 로고 그대로 두고 이모지 없이 `font-display`만으로 표현한다 — 헤더는 작은 UI라 커스텀 아이콘을 넣기엔 과함.

### ActivitySelectPage
카테고리 라벨 배지를 `CATEGORY_TINT`(이미 `KkumiCharacter.tsx`에 정의된 카테고리별 색) 기준으로 통일. 활동 리스트 아이템에 카테고리 아이콘(운동/학업/독서/기타 각각 다른 픽토그램) 추가.

### TimerPage
가장 큰 변경 지점. 현재 `text-5xl` 숫자만 있는 걸 원형 진행 링(SVG `<circle>` stroke-dasharray, `icon-choice`류와 동일한 톤)으로 감싸고, 중앙에 Do Hyeon으로 시간 표시. 일시정지 상태는 링 색을 honey 톤으로 전환.

### HomePage
브레인스토밍에서 확정한 안 그대로: 캐릭터 원형 진행 링 + LV 뱃지, `StatBadge` 3종(연속일/누적/뱃지 — 지금은 정적/모의값, V2에서 실 데이터로 교체), 기존 `ActivityHeatmap` 유지.

### HistoryPage
엔트리 리스트 카드에 카테고리 아이콘 추가, range 셀렉트 스타일 통일. 리스트 자체 구조는 유지(차트 시각화는 V2 "히스토리 차트/리포트 강화" 범위).

## 기타

`frontend/vite.config.ts`의 `VitePWA` manifest `theme_color`가 `#22c55e`(초록)로 새 코랄 팔레트와 맞지 않는다. `#ff7a9c`(coral)로 갱신한다.

## 테스트

기존 테스트는 텍스트/역할(role) 기반 쿼리를 쓰므로 아이콘 교체·폰트 적용만으로는 깨지지 않아야 한다. 새로 추가하는 `StatBadge`, 아이콘 컴포넌트에는 렌더 스모크 테스트를 추가한다. 시각적 회귀는 `/run` 스킬로 dev 서버 띄워 수동 확인.

## 범위 밖

- 다크모드
- 반응형/모바일 레이아웃 재설계 (현재도 Tailwind 반응형 클래스 일부 있음, 유지만 함)
- V2의 4개 기능 (뱃지 실데이터, 스트릭 계산, 주간 목표, 푸시 알림)
