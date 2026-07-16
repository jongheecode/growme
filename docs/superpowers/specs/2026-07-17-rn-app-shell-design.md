# RN 앱 골격 (Sub-project 1 of 8) — Design Spec

## 배경

2026-07-17, GrowMe를 타이머 중심 웹 PWA에서 React Native 앱으로 전면 피벗하기로 결정했다(자세한 배경과 전체 서브프로젝트 목록은 브레인스토밍 대화 및 프로젝트 메모리 `project_v2_app_pivot` 참고). 새 코어 루프는 "꾸미와의 대화 → 목표 설정 → 할일(미션) 완료 → XP 획득 → 꾸미 성장"이며, 타이머는 미션 실행 화면에 종속된 보조 기능이 된다.

이 스펙은 8개 서브프로젝트 중 **가장 먼저 만드는 기초 골격**만 다룬다. 꾸미 홈 화면, XP/성장 시스템, AI 대화, 미션, 타이머, 히스토리, 소셜, 포인트샵은 전부 이후 서브프로젝트의 범위이며 이 스펙에는 포함하지 않는다.

## 목표

로그인/회원가입이 되고, 로그인 후 하단 탭(홈/히스토리/프로필) 사이를 이동할 수 있는 빈 껍데기 앱을 만든다. 각 탭의 실제 내용은 채우지 않는다 — 이후 서브프로젝트가 이 골격 위에 화면을 얹는다.

## 범위 밖 (Out of scope)

- 꾸미 홈 화면 내용, XP/성장/할일/타이머/AI 대화/히스토리 목록/소셜/포인트샵 — 전부 이후 서브프로젝트.
- 기존 웹(`frontend/`) 코드 삭제나 정리 — 이번에는 건드리지 않는다.
- 백엔드(`backend/`) 코드 변경 — 기존 auth API를 그대로 재사용하며, 이 스펙에서는 백엔드에 아무 변경도 하지 않는다.
- 푸시 알림, 딥링크, 앱 아이콘/스플래시 등 스토어 배포용 폴리시 — 나중 단계.

## 아키텍처

새 폴더 `mobile/`에 Expo(managed workflow, TypeScript 템플릿) 프로젝트를 생성한다. 기존 `backend/`를 API 서버로 그대로 쓰고, iOS/Android를 동시에(같은 코드베이스로) 타겟한다.

**디렉토리 구조:**
```
mobile/
  App.tsx
  app.json
  package.json
  src/
    api/
      client.ts       # apiFetch — 기존 frontend/src/api/client.ts와 동일 패턴, 토큰 저장만 SecureStore로 교체
      auth.ts          # login(), signup() — 기존 frontend/src/api/auth.ts와 동일 계약
    context/
      AuthContext.tsx  # 기존 frontend/src/context/AuthContext.tsx와 동일 패턴, SecureStore 기반
    navigation/
      RootNavigator.tsx  # token 유무로 AuthStack ↔ MainTabs 분기
      AuthStack.tsx       # Login, Signup
      MainTabs.tsx        # Home, History, Profile (전부 placeholder)
    screens/
      LoginScreen.tsx
      SignupScreen.tsx
      HomeScreen.tsx      # placeholder
      HistoryScreen.tsx   # placeholder
      ProfileScreen.tsx   # placeholder
```

**네비게이션:** React Navigation. 앱 시작 시 `AuthContext`가 SecureStore에서 토큰을 읽어 로딩 상태를 거친 뒤, 토큰이 있으면 `MainTabs`(하단 탭 네비게이터), 없으면 `AuthStack`(로그인/회원가입 스택)을 보여준다.

## 화면

- **LoginScreen** — 이메일/비밀번호 입력, `POST /api/auth/login` 호출, 성공 시 토큰을 `AuthContext.login()`으로 저장. 실패 시 인라인 에러 메시지("이메일 또는 비밀번호가 올바르지 않습니다" 등 백엔드 에러 그대로 표시).
- **SignupScreen** — 이메일/비밀번호/닉네임 입력, `POST /api/auth/signup` 호출, 성공 시 자동 로그인(토큰 저장).
- **HomeScreen / HistoryScreen / ProfileScreen** — 각각 "준비 중입니다" 같은 텍스트만 있는 placeholder. 탭 아이콘/라벨(홈·히스토리·프로필)과 로그아웃 버튼(ProfileScreen에 임시로 배치)만 동작하면 된다.

## 데이터 흐름 (인증)

기존 웹의 `AuthContext` 패턴을 그대로 이식하되 저장소만 바꾼다:

```ts
// mobile/src/context/AuthContext.tsx (패턴)
const [token, setToken] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  SecureStore.getItemAsync('growme_token').then(t => { setToken(t); setIsLoading(false); });
}, []);

async function login(newToken: string) {
  await SecureStore.setItemAsync('growme_token', newToken);
  setToken(newToken);
}

async function logout() {
  await SecureStore.deleteItemAsync('growme_token');
  setToken(null);
}
```

`RootNavigator`는 `isLoading`인 동안 로딩 스피너를, 이후 `token` 유무로 `AuthStack`/`MainTabs`를 렌더링한다. `apiFetch`는 매 요청마다 SecureStore에서 토큰을 읽어 `Authorization: Bearer <token>` 헤더를 붙인다(기존 웹의 `apiFetch`와 동일한 계약, 저장소 API만 비동기로 바뀜).

**API 베이스 URL:** 기존 웹은 `VITE_API_BASE`(브라우저 기준 `localhost:4000`)를 썼지만, 모바일 실기기(및 Android 에뮬레이터 — `localhost`가 에뮬레이터 자신을 가리켜 호스트 머신에 닿지 않음)는 개발 머신의 `localhost`에 접근할 수 없다. `mobile/app.config.ts`의 `expo.extra.apiBase`에 개발 머신의 LAN IP를 설정하고(예: `http://192.168.x.x:4000`) `expo-constants`로 읽어 `api/client.ts`의 베이스 URL로 쓴다. iOS 시뮬레이터는 `localhost`로도 접근 가능하지만 실기기·Android 에뮬레이터와 동일하게 LAN IP 방식으로 통일해 분기 로직을 두지 않는다. 백엔드는 이미 `cors()`를 제한 없이 열어두고 있어(`backend/src/app.ts:12`) 별도 백엔드 변경은 필요 없다.

## 에러 처리

- 네트워크/서버 에러는 로그인/회원가입 폼에 인라인 텍스트로 표시(웹과 동일 톤).
- 401(토큰 만료/무효)이 다른 화면에서 발생하는 시나리오는 아직 없음(placeholder 화면이라 인증된 API를 호출하지 않음) — 이 처리는 실제 데이터를 붙이는 이후 서브프로젝트에서 다룬다.

## 테스팅

Jest + React Native Testing Library(웹의 Vitest + @testing-library/react 컨벤션과 동일한 자리). 이번 서브프로젝트에서 확인할 것:
- 로그인 성공 시 토큰이 저장되고 탭 화면으로 전환된다(폼 제출 → mocked fetch → SecureStore 저장 확인).
- 로그인 실패 시 에러 메시지가 보인다.
- 회원가입 성공 시 자동 로그인된다.
- 앱 시작 시 저장된 토큰이 있으면 탭 화면으로, 없으면 로그인 화면으로 바로 간다.
- 탭 3개를 오가며 각 placeholder 화면이 렌더링된다.
- 로그아웃하면 다시 로그인 화면으로 돌아간다.

## Global Constraints

- 기존 백엔드 API 계약(엔드포인트, 요청/응답 shape)을 변경하지 않는다 — 순수 클라이언트 작업.
- `frontend/`(기존 웹)는 이번 서브프로젝트에서 수정도 삭제도 하지 않는다.
- 각 탭의 실제 콘텐츠(꾸미 홈, 히스토리 목록 등)를 이번 범위에서 구현하지 않는다 — placeholder로 남긴다.
- iOS/Android 양쪽에서 동작해야 한다(Expo 관리형 워크플로우 기준 기본 지원 범위 내).
