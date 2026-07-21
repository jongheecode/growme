# 비주얼 디자인 적용 (서브프로젝트 9)

## 배경

사용자가 Claude 디자인 툴로 GrowMe 컨셉 보드 + 인터랙티브 프로토타입(`GrowMe.dc.html`, `Kkumi.dc.html`, `support.js`, `download`(썸네일))을 만들어왔다. 이 문서는 그 결과물을 실제 RN 앱(`mobile/`)에 반영하기 위한 스펙이다.

디자인 파일 자체는 웹(React DOM + CSS) 기반 목업이라 RN에 그대로 쓸 수 없다. 이 스펙은 그 디자인을 RN으로 "포팅"하는 방법을 정의한다.

## 디자인 소스 요약

- **팔레트**: 배경 크림 `#FBF6EE`(카드는 `#FFFDF9`), 테두리 `#ECE1D2`, 텍스트 잉크 `#4A4038`/보조 `#8A7E72`/연한보조 `#B0A493`, 포인트 그린 `#5FA97D`(진한 `#4A8863`), XP골드 `#F3C969`(텍스트 `#B58A2E`, 배경 `#FFF6E0`), 라벤더 `#B7A6E4`(챌린지 포인트), 피치 `#EE9E86`(운동 카테고리 등)
- **꾸미 종 팔레트** (mint/peach/lav): mint `{body:#8FD1A6, lite:#B8E4C6, dark:#5FA97D, cheek:#F2A98F, shell:#DDF0E2}`, peach `{body:#F6B396, lite:#FBD3C0, dark:#E08862, cheek:#EE9E86, shell:#FBE4D8}`, lav `{body:#B7A6E4, lite:#D6CCF2, dark:#9179CC, cheek:#F2A98F, shell:#E6DEF6}`
- **폰트**: 제목/숫자/버튼 = Jua, 본문 = Gowun Dodum (둘 다 구글 폰트, 한글 지원)
- **꾸미 캐릭터**: 이미지 없이 순수 도형(원/그라디언트/보더)으로 그려짐. 5단계(알/부화/새싹/자람/만개), stage>=3에서 팔, stage>=4에서 다리 추가. 모자 5종(beanie/cap/crown/flower/party), 안경 3종(round/sun/star, stage<2에서는 렌더 안 함)

## 매핑 결정 (기존 코드 ↔ 디자인)

- `Species` enum(`SPECIES_A`/`SPECIES_B`/`SPECIES_C`, 백엔드에 의미 없는 임의 구분)을 디자인의 `mint`/`peach`/`lav`에 순서대로 매핑한다. 순서는 임의 — 백엔드가 종 이름에 의미를 두지 않으므로 A→mint, B→peach, C→lav로 고정.
- Stage 0~4는 이미 백엔드·디자인 양쪽 다 5단계라 그대로 재사용한다 (알/부화/새싹/자람/만개).
- 기존 악세서리 카탈로그(`ribbon`/`crown`→HAT, `round_glasses`→FACE, `star_bg`/`rainbow_bg`→BACKGROUND)는 이번 스코프에서 **바꾸지 않는다**. 카탈로그를 디자인의 5모자/3안경 풀세트로 확장하는 건 별도 스코프. 대신 이번엔 이미 존재하는 3개 시각 아이템(`ribbon`, `crown`, `round_glasses`)만 실제 도형으로 렌더링한다.
- `BACKGROUND` 슬롯 악세서리(`star_bg`, `rainbow_bg`)는 디자인상 "홈 화면 배경 테마" 개념이라 꾸미 캐릭터 자체에는 렌더링하지 않는다 (홈 배경 테마 적용은 별도 스코프로 남긴다).

## 구현 범위

1. **`react-native-svg`** 설치 (Expo 표준 SVG 라이브러리) — 곡선/타원형 보더radius/그라디언트를 정확히 재현하기 위해 plain `View` 대신 SVG로 캐릭터를 그린다.
2. **폰트**: `@expo-google-fonts/jua`, `@expo-google-fonts/gowun-dodum` + `expo-font` 설치, 앱 루트에서 `useFonts`로 로드.
3. **`mobile/src/theme.ts`** (신규): 컬러 토큰 + 폰트 패밀리 상수.
4. **`KkumiView.tsx`** 전면 재작성: SVG 기반, `species`(mint/peach/lav 매핑) × `stage`(0~4) × 장착 악세서리(ribbon/crown/round_glasses)를 반영해 그린다. 기존 prop 시그니처(`species`, `stage`, `accessories`)는 유지 — 소비하는 화면들(Home/Friends/Profile/Shop/Leaderboard) 코드 변경 불필요.
5. 나머지 화면(Home/History/Friends/Shop/Profile/Leaderboard/Challenges 등)에 테마 컬러·폰트를 순차 적용 — 레이아웃 구조는 이미 완성돼 있으므로 색/폰트/여백 위주 스타일링.

이번 스펙에서는 1~4(캐릭터 + 디자인 토큰 기반 마련)를 우선 구현하고, 5(화면별 스타일링)는 이어서 순차 진행한다.
