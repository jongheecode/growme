# 디자인 자산 통합 (제공된 HTML 목업 반영)

## 배경

사용자가 별도 AI 도구로 만든 완성도 높은 HTML/CSS/SVG 목업 5개를 `html/` 폴더에 제공했다:
- `growme_login_animated_css_keyframes.html` — 로그인 화면(애니메이션 배경+나무 팻말)
- `growme_home_screen_dashboard.html` — 홈 대시보드
- `growme_history_screen_session_list.html` — 히스토리 목록
- `growme_profile_screen_account.html` — 프로필
- `kkumi_roaming_stages_categories_interactive.html` — 꾸미 캐릭터 생성기(스테이지×카테고리 조합, 걷기 애니메이션, 클릭 인터랙션)

이 문서는 이 5개 목업을 실제 React+Tailwind 코드로 이식하는 범위를 정의한다. 목업은 순수 HTML/인라인 `<script>`(vanilla DOM API)로 작성되어 있어 그대로 붙여넣을 수 없다 — React 컴포넌트/훅으로 다시 작성하되, **색상 값·SVG 좌표·애니메이션 타이밍·레이아웃 구조는 목업 그대로 유지**한다(디자인 판단은 이미 끝났고, 이번 작업은 이식이다).

이식이 끝나고 각 페이지가 목업과 동등한 결과물을 내면 `html/` 폴더는 삭제한다.

## 새로 도입되는 디자인 토큰

목업에서 기존 `index.css` 토큰에 없는 색상이 다수 발견됨. `@theme`에 추가:
```css
--color-grass-light: #c8e6ab;
--color-grass: #96cc7c;
--color-grass-dark: #4f8f3d;
--color-card-border: #f0e2cf;
--color-card-bg: #fffdf9;
--color-tan: #a08a76;
--color-tan-dark: #8a6a4a;
--color-wood-light: #f0c48c;
--color-wood: #c98f52;
--color-wood-dark: #8d5f31;
```
카테고리별 5색 팔레트(`kkumi_roaming...` 파일의 `C` 객체 — lo/mid/hi/ear/bel/egg/shell 7톤 × 4카테고리)는 토큰화하지 않고 `frontend/src/components/kkumi/palette.ts`에 상수 객체로 둔다(재사용은 캐릭터 렌더링에서만 발생하므로 전역 테마에 넣을 이유가 없음).

## 아이콘: Tabler Icons 도입

홈/히스토리/프로필 목업이 `<i class="ti ti-flame">` 형태로 Tabler Icons 폰트를 가정한다. 웹폰트 대신 `@tabler/icons-react`(트리쉐이킹되는 개별 아이콘 컴포넌트)를 신규 의존성으로 추가하고, `<i class="ti ti-flame">` → `<IconFlame size={17} />` 식으로 치환한다. 사용되는 아이콘: `flame`(연속일), `book`(뱃지/독서), `clock`(누적시간), `lock`(잠긴뱃지/비번변경), `notebook`(공부), `run`(운동), `star`(기타), `bell`(알림설정), `logout`(로그아웃), `trash`(회원탈퇴).

이번 작업 이전에 만든 V1의 커스텀 아이콘(`components/icons/BoltIcon.tsx` 등 6종)은 이 목업들이 대체한다 — 목업에서 요구하는 아이콘 세트와 다르므로, V1 아이콘은 더 이상 새 페이지에서 쓰지 않지만 기존 코드 삭제는 이번 범위에 포함하지 않는다(사용처가 없어지면 자연히 죽은 코드가 되고, 정리는 후속 커밋에서).

## `KkumiCharacter` 전면 재작성

`kkumi_roaming_stages_categories_interactive.html`의 `kkumi(stage, cat, r)` 함수(순수 SVG DOM 생성 로직)를 `frontend/src/components/kkumi/renderKkumi.tsx`로 이식한다 — DOM API(`document.createElementNS`) 대신 **JSX를 반환하는 함수**로 재작성한다(React 엘리먼트를 리턴하는 순수 함수, 컴포넌트 아님 — `stage`/`category`/`radius`를 받아 `<g>` 트리를 반환).

기존 `KkumiCharacter.tsx`(V1, 4단계 각각 하드코딩된 별도 함수)를 이 새 렌더러를 감싸는 얇은 래퍼로 교체한다:
```tsx
export function KkumiCharacter({ stage, category, radius = 40 }: { stage: number; category: Category; radius?: number }) {
  const visualStage = Math.min(stage, 3);
  return (
    <svg viewBox={`${-radius * 1.3} ${-radius * 1.3} ${radius * 2.6} ${radius * 2.6}`} className="w-full h-full">
      {renderKkumi(visualStage, category, radius)}
    </svg>
  );
}
```
기존 시그니처(`{stage, category}` props)를 유지해 V1에서 이미 이 컴포넌트를 쓰는 곳(HomePage, LoginPage)이 깨지지 않게 한다.

**걷기 애니메이션 + 클릭 인터랙션**은 별도 컴포넌트 `frontend/src/components/kkumi/KkumiHerd.tsx`로 분리한다 — `requestAnimationFrame` 루프, 위치 상태, 클릭 시 도망 로직을 `useEffect` 안에서 관리하는 React 버전. 홈 화면 히어로, 로그인 배경에서 재사용한다.

## 페이지별 반영

### LoginPage
목업의 SVG 배경(하늘/구름/언덕 4겹/풀잎 흔들림/꽃잎 낙하/나무 팻말+금속 장식 없이 텍스트가 나무판에 직접 새겨진 형태/떠다니는 꾸미 5마리)을 그대로 이식하되, **이메일/비밀번호 입력창과 시작하기 버튼은 목업처럼 SVG `<rect>`+`<text>`로 그리지 않고 실제 HTML `<input>`/`<button>`을 SVG 위에 절대좌표로 겹쳐서** 기능이 동작하게 한다. 좌표 변환: 목업 `viewBox="0 0 680 430"` 기준 픽셀 좌표를 퍼센트로 환산해 CSS `position: absolute; left/top/width/height: n%`로 배치(예: 이메일 입력 `rect x=196 y=194 width=288 height=38` → `left: 28.8%; top: 45.1%; width: 42.4%; height: 8.8%`). 폼 필드는 목업의 시각 스타일(베이지 그라디언트 배경, 갈색 보더)을 Tailwind 임의값으로 재현한다.

### HomePage
목업의 2컬럼 레이아웃(왼쪽 히어로 SVG — 캐릭터가 숨쉬며 눈 깜빡임, 오른쪽 사이드 — 이름/레벨/진행바/3스탯카드/뱃지row/CTA버튼) + 하단 6개월 히트맵(182칸, 5단계 색상)을 그대로 이식하되 **목업의 랜덤/더미 데이터(`Math.random()` 히트맵, 하드코딩 스탯)를 실제 API 데이터로 교체**한다:
- 진행바 %, "다음 단계까지 n시간/m시간": V2가 아직 없으므로 `growth.currentGauge`와 다음 스테이지 임계값(프론트에 하드코딩하지 않고, 우선 퍼센트 없이 게이지 시간만 표시 — 정확한 다음 단계 임계값은 백엔드 상수라 프론트에서 재현 불가. 진행바는 `currentGauge % 10시간` 같은 근사치 대신, 이번 범위에서는 진행바를 "단계 내 진행률 불명" 상태로 두고 **누적시간만 표시**하고 바는 100% 고정 장식으로 둔다 — 부정확한 수치를 보여주는 것보다 낫다)
- 3스탯카드(연속일/누적시간/이번주): V1의 `computeCurrentStreak`+`useDailyTotals` 재사용(연속일), `growth.currentGauge`(누적시간), `useDailyTotals('weekly')` 합계(이번주)
- 뱃지row: V2 미구현이므로 5칸 전부 잠금 아이콘으로 고정 표시(목업처럼 일부 해금된 것처럼 보이면 조작된 데이터가 됨)
- 히트맵: `useDailyTotals('weekly')`가 아니라 6개월(약 182일) 범위가 필요 — 백엔드 `GET /api/history`에 `range=weekly`(4주) 이상이 없으므로, 이번 작업에서 `range=6months`를 백엔드에 추가한다(`src/routes/history.ts`의 `since` 계산에 분기 추가, 프론트 `getHistory` 타입에 `'6months'` 추가)

### HistoryPage
목업의 필터 pill(전체/공부/운동/독서/기타) + 날짜별 그룹 + 세션 행(아이콘/제목/부제/진행바/시간) 레이아웃을 그대로 이식. 목업은 세션에 "제목"(예: "알고리즘 문제풀이")이 있지만 **현재 백엔드 `Session`/`Activity`엔 세션 단위 제목이 없다** — `Activity.name`(활동 이름, 이미 있음)을 세션 행의 제목으로 쓴다(목업의 "제목"을 활동 이름으로 대체, 세션 시작 시각은 기존 `Session.startedAt` 사용). 진행바(`x.m/120*100`, 120분 기준 정규화)는 그대로 이식하되 120분을 상수로 명시.

### ProfilePage
목업의 아바타(꾸미 SVG, 알 단계 아님 — 캐릭터 렌더러의 아무 단계나 사용 가능하므로 `growth.stage` 그대로 사용)+정보+4스탯그리드+카테고리별 누적 바+계정설정 리스트 레이아웃을 그대로 이식. `2026-07-16-v1.5-desktop-shell-profile-design.md`에서 이미 정의한 백엔드(bio, change-password, delete)는 그대로 사용하되, **프론트 `ProfilePage.tsx`는 이 목업 레이아웃으로 새로 작성**(해당 스펙 문서의 프론트 섹션은 이 문서로 대체됨). 카테고리별 누적 바는 히스토리 데이터를 카테고리로 집계해서 계산(신규 프론트 유틸 `computeCategoryTotals`). "총 세션" 스탯은 세션 개수 — 현재 백엔드에 카운트 API가 없으므로 `GET /api/history?range=6months`로 가져온 엔트리 개수로 근사(엔트리는 날짜×카테고리 단위 집계라 정확한 세션 수가 아님 — 정확한 값이 필요하면 후속 API가 필요하다는 점을 범위 밖에 명시). "회원가입 n일째"는 `createdAt` 기준 계산.

## 테스트
포팅된 각 페이지는 V1 컨벤션대로 `<file>.test.tsx`. `renderKkumi` 순수 함수는 `renderKkumi.test.tsx`(스테이지별로 예외 없이 렌더되는지, 카테고리별로 다른 팔레트가 적용되는지). `KkumiHerd`의 requestAnimationFrame 로직은 실제 애니메이션 프레임을 테스트하지 않고 "여러 마리가 렌더되는지"만 스모크 테스트.

## 범위 밖
- 홈 화면 진행바의 정확한 %(다음 단계 임계값 백엔드 노출 필요 — 후속)
- 히스토리 "총 세션 수" 정확한 카운트 API
- `html/` 폴더의 인터랙티브 재생 로직(놀이터의 requestAnimationFrame 걷기 애니메이션)을 히트맵 등 다른 화면까지 확장하는 것 — 이번엔 명시된 4페이지 + 캐릭터 렌더러만
