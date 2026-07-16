# RN 앱 골격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `mobile/`에 Expo(TypeScript) 프로젝트를 새로 만들고, 기존 백엔드 인증 API를 그대로 재사용하는 로그인/회원가입 화면과, 로그인 후 하단 탭(홈/히스토리/프로필 — 전부 placeholder) 사이를 이동할 수 있는 앱 골격을 완성한다.

**Architecture:** Expo managed workflow + React Navigation(네이티브 스택 + 하단 탭). 인증 상태는 `AuthContext`가 `expo-secure-store`에 토큰을 저장/조회하며 관리하고, `RootNavigator`가 토큰 유무로 `AuthStack`(로그인/회원가입) ↔ `MainTabs`(홈/히스토리/프로필)를 전환한다. API 클라이언트는 기존 웹의 `frontend/src/api/client.ts` 패턴을 그대로 이식하되 토큰 저장소만 `localStorage`→`SecureStore`로 바꾼다. 백엔드(`backend/`)는 이 플랜에서 전혀 수정하지 않는다.

**Tech Stack:** React Native(Expo SDK, TypeScript) + React Navigation, `expo-secure-store`, `expo-constants`. 테스트는 `jest-expo` + `@testing-library/react-native`.

## Global Constraints

- 기존 백엔드 API 계약(`POST /api/auth/login`, `POST /api/auth/signup`의 요청/응답 shape)을 변경하지 않는다 — 순수 클라이언트 작업.
- `frontend/`(기존 웹)는 이 플랜에서 수정도 삭제도 하지 않는다.
- 각 탭의 실제 콘텐츠(꾸미 홈, 히스토리 목록 등)는 이 플랜의 범위가 아니다 — "준비 중입니다" placeholder로 남긴다.
- iOS/Android 양쪽에서 동작해야 한다(Expo 관리형 워크플로우 기본 지원 범위 내에서 별도 플랫폼 분기 코드를 두지 않는다).
- 모바일 API 베이스 URL은 `localhost`가 아니라 개발 머신의 LAN IP를 `app.json`의 `expo.extra.apiBase`로 설정해 쓴다(iOS 시뮬레이터도 실기기/Android 에뮬레이터와 동일하게 통일).

---

## 파일 구조

**신규 생성**
- `mobile/`(Expo 프로젝트 전체 — CLI로 스캐폴드)
- `mobile/jest.setup.ts`
- `mobile/src/api/client.ts`
- `mobile/src/api/auth.ts`
- `mobile/src/api/auth.test.ts`
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/context/AuthContext.test.tsx`
- `mobile/src/navigation/AuthStack.tsx`
- `mobile/src/navigation/MainTabs.tsx`
- `mobile/src/navigation/RootNavigator.tsx`
- `mobile/src/navigation/RootNavigator.test.tsx`
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/HistoryScreen.tsx`
- `mobile/src/screens/ProfileScreen.tsx`
- `mobile/src/screens/ProfileScreen.test.tsx`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/screens/LoginScreen.test.tsx`
- `mobile/src/screens/SignupScreen.tsx`
- `mobile/src/screens/SignupScreen.test.tsx`

**수정**
- `mobile/App.tsx` (CLI 생성본을 `AuthProvider` + `RootNavigator`로 교체)
- `mobile/package.json` (jest 설정 추가)
- `mobile/app.json` (`expo.extra.apiBase` 추가)

---

### Task 1: Expo 프로젝트 스캐폴드 + 테스트 하네스

**Files:**
- Create: `mobile/`(CLI 생성)
- Modify: `mobile/package.json`, `mobile/app.json`

- [ ] **Step 1: Expo 프로젝트 생성**

Run (저장소 루트에서): `npx create-expo-app@latest mobile --template blank-typescript`
Expected: `mobile/` 디렉토리가 생기고 `App.tsx`, `package.json`, `app.json`, `tsconfig.json` 등이 포함됨

- [ ] **Step 2: 네비게이션 + SecureStore + Constants 의존성 설치**

Run: `cd mobile && npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context expo-secure-store expo-constants`
Expected: `mobile/package.json`의 `dependencies`에 위 패키지들이 추가됨

- [ ] **Step 3: 테스트 의존성 설치**

Run: `cd mobile && npm install --save-dev jest-expo jest @testing-library/react-native @types/jest`
Expected: `mobile/package.json`의 `devDependencies`에 추가됨

- [ ] **Step 4: `package.json`에 test 스크립트/jest 설정 추가**

`mobile/package.json`의 `"scripts"` 블록에 다음을 추가(이미 있는 `"start"` 등은 그대로 둠):
```json
    "test": "jest"
```
`"scripts"` 블록 다음(최상위)에 추가:
```json
  "jest": {
    "preset": "jest-expo",
    "setupFiles": ["<rootDir>/jest.setup.ts"]
  }
```

- [ ] **Step 5: SecureStore 전역 목 작성**

`mobile/jest.setup.ts`:
```ts
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
```

- [ ] **Step 6: `app.json`에 API 베이스 URL 설정 추가**

`mobile/app.json`의 `"expo"` 객체 안(최상위 키들과 같은 레벨)에 추가:
```json
    "extra": {
      "apiBase": "http://192.168.1.100:4000"
    }
```
(`192.168.1.100`은 개발 머신의 실제 LAN IP로 각자 바꿔 쓰는 자리표시자 — 이 플랜에서는 값 자체보다 필드가 존재하고 Task 2에서 읽힌다는 게 중요)

- [ ] **Step 7: 타입체크 + 스모크 테스트 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

Run: `cd mobile && npx jest --listTests`
Expected: 에러 없이 실행됨(아직 테스트 파일이 없으므로 목록은 비어 있을 수 있음)

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat: Expo 프로젝트 스캐폴드 + 네비게이션/SecureStore 의존성, jest 설정"
```

---

### Task 2: API 클라이언트 (`client.ts` + `auth.ts`)

**Files:**
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/auth.ts`
- Create: `mobile/src/api/auth.test.ts`

**Interfaces:**
- Produces: `apiFetch(path, options)`(`client.ts`) — Task 3(AuthContext는 직접 안 씀), Task 5/6(LoginScreen/SignupScreen이 `auth.ts`를 통해 간접 사용)에서 씀. `login(email, password): Promise<string>`, `signup(email, password, nickname): Promise<string>`(`auth.ts`) — 둘 다 성공 시 토큰 문자열을 반환하고 실패 시 throw.

- [ ] **Step 1: `client.ts` 구현**

`mobile/src/api/client.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const API_BASE =
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('growme_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  return res;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`mobile/src/api/auth.test.ts`:
```ts
import { login, signup } from './auth';

describe('login', () => {
  it('returns the token on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ token: 'abc123' }) })
    ) as unknown as typeof fetch;

    const token = await login('a@b.com', 'password123');
    expect(token).toBe('abc123');
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: async () => ({ error: 'invalid credentials' }) })
    ) as unknown as typeof fetch;

    await expect(login('a@b.com', 'wrong')).rejects.toThrow('로그인에 실패했어요');
  });
});

describe('signup', () => {
  it('returns the token on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ token: 'xyz789' }) })
    ) as unknown as typeof fetch;

    const token = await signup('a@b.com', 'password123', '닉네임');
    expect(token).toBe('xyz789');
  });
});
```

- [ ] **Step 3: 실행해 실패 확인**

Run: `cd mobile && npx jest src/api/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 4: `auth.ts` 구현**

`mobile/src/api/auth.ts`:
```ts
import { apiFetch } from './client';

interface AuthResponse {
  token: string;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('로그인에 실패했어요');
  const data = (await res.json()) as AuthResponse;
  return data.token;
}

export async function signup(
  email: string,
  password: string,
  nickname: string
): Promise<string> {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) throw new Error('회원가입에 실패했어요');
  const data = (await res.json()) as AuthResponse;
  return data.token;
}
```

- [ ] **Step 5: 실행해 통과 확인**

Run: `cd mobile && npx jest src/api/auth.test.ts`
Expected: PASS (3개 테스트)

- [ ] **Step 6: Commit**

```bash
git add mobile/src/api/client.ts mobile/src/api/auth.ts mobile/src/api/auth.test.ts
git commit -m "feat: 모바일 API 클라이언트 (login/signup) 추가"
```

---

### Task 3: AuthContext

**Files:**
- Create: `mobile/src/context/AuthContext.tsx`
- Create: `mobile/src/context/AuthContext.test.tsx`

**Interfaces:**
- Consumes: 없음(SecureStore 직접 사용, `client.ts`와 별개 경로).
- Produces: `AuthProvider`, `useAuth(): { token: string | null; isLoading: boolean; login(token: string): Promise<void>; logout(): Promise<void> }` — Task 4(RootNavigator), Task 5/6(Login/SignupScreen), Task 7(ProfileScreen 로그아웃)에서 씀.

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/context/AuthContext.test.tsx`:
```tsx
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { token, isLoading, login, logout } = useAuth();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text testID="token">{token ?? 'no-token'}</Text>
      <Button title="login" onPress={() => login('new-token')} />
      <Button title="logout" onPress={() => logout()} />
    </>
  );
}

describe('AuthContext', () => {
  it('starts with no token when SecureStore is empty', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('no-token'));
  });

  it('loads a stored token on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('stored-token'));
  });

  it('login stores the token and updates state', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('no-token'));
    await act(async () => {
      screen.getByText('login').props.onPress();
    });
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('new-token'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('growme_token', 'new-token');
  });

  it('logout clears the token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('stored-token'));
    await act(async () => {
      screen.getByText('logout').props.onPress();
    });
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('no-token'));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('growme_token');
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd mobile && npx jest src/context/AuthContext.test.tsx`
Expected: FAIL — `Cannot find module './AuthContext'`

- [ ] **Step 3: `AuthContext.tsx` 구현**

`mobile/src/context/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('growme_token').then((stored) => {
      setToken(stored);
      setIsLoading(false);
    });
  }, []);

  async function login(newToken: string) {
    await SecureStore.setItemAsync('growme_token', newToken);
    setToken(newToken);
  }

  async function logout() {
    await SecureStore.deleteItemAsync('growme_token');
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd mobile && npx jest src/context/AuthContext.test.tsx`
Expected: PASS (4개 테스트)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/context/AuthContext.tsx mobile/src/context/AuthContext.test.tsx
git commit -m "feat: AuthContext (SecureStore 기반 토큰 상태) 추가"
```

---

### Task 4: 네비게이션 골격 + placeholder 화면

**Files:**
- Create: `mobile/src/screens/HomeScreen.tsx`
- Create: `mobile/src/screens/HistoryScreen.tsx`
- Create: `mobile/src/screens/ProfileScreen.tsx`
- Create: `mobile/src/navigation/AuthStack.tsx`
- Create: `mobile/src/navigation/MainTabs.tsx`
- Create: `mobile/src/navigation/RootNavigator.tsx`
- Create: `mobile/src/navigation/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `useAuth`(Task 3).
- Produces: `AuthStackParamList`, `MainTabsParamList`(`navigation/AuthStack.tsx`, `navigation/MainTabs.tsx`) — Task 5/6(LoginScreen/SignupScreen이 네비게이션 타입으로 씀). `RootNavigator`(default export) — Task 7에서 `App.tsx`가 씀.
- 이 태스크에서는 `LoginScreen`/`SignupScreen`을 아직 만들지 않으므로, `AuthStack`은 임시로 인라인 placeholder 컴포넌트를 화면으로 등록한다(Task 5/6에서 실제 화면으로 교체).

- [ ] **Step 1: placeholder 화면 3개 구현**

`mobile/src/screens/HomeScreen.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>홈 화면 준비 중입니다</Text>
    </View>
  );
}
```

`mobile/src/screens/HistoryScreen.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>히스토리 화면 준비 중입니다</Text>
    </View>
  );
}
```

`mobile/src/screens/ProfileScreen.tsx`:
```tsx
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
    </View>
  );
}
```
(Task 7에서 이 파일에 로그아웃 버튼을 추가함)

- [ ] **Step 2: `MainTabs.tsx` 구현**

`mobile/src/navigation/MainTabs.tsx`:
```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type MainTabsParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: '히스토리' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '프로필' }} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 3: `AuthStack.tsx` 구현 (임시 placeholder 화면 포함)**

`mobile/src/navigation/AuthStack.tsx`:
```tsx
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

function LoginPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>로그인 화면 준비 중입니다</Text>
    </View>
  );
}

function SignupPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>회원가입 화면 준비 중입니다</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginPlaceholder} />
      <Stack.Screen name="Signup" component={SignupPlaceholder} />
    </Stack.Navigator>
  );
}
```
(Task 5/6에서 `LoginPlaceholder`/`SignupPlaceholder`를 실제 `LoginScreen`/`SignupScreen`으로 교체)

- [ ] **Step 4: `RootNavigator.tsx` 구현**

`mobile/src/navigation/RootNavigator.tsx`:
```tsx
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

export default function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <NavigationContainer>{token ? <MainTabs /> : <AuthStack />}</NavigationContainer>;
}
```

- [ ] **Step 5: 실패하는 테스트 작성**

`mobile/src/navigation/RootNavigator.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import RootNavigator from './RootNavigator';

describe('RootNavigator', () => {
  it('shows the auth stack when there is no stored token', async () => {
    render(
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('로그인 화면 준비 중입니다')).toBeTruthy());
  });

  it('shows the main tabs when a token is stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    render(
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('홈 화면 준비 중입니다')).toBeTruthy());
  });
});
```

- [ ] **Step 6: 실행해 통과 확인**

Run: `cd mobile && npx jest src/navigation/RootNavigator.test.tsx`
Expected: PASS (2개 테스트) — 이미 구현이 다 되어 있으므로 실패 없이 바로 통과해야 함

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/HomeScreen.tsx mobile/src/screens/HistoryScreen.tsx mobile/src/screens/ProfileScreen.tsx mobile/src/navigation/
git commit -m "feat: 네비게이션 골격(AuthStack/MainTabs/RootNavigator) + placeholder 화면 추가"
```

---

### Task 5: LoginScreen

**Files:**
- Create: `mobile/src/screens/LoginScreen.tsx`
- Create: `mobile/src/screens/LoginScreen.test.tsx`
- Modify: `mobile/src/navigation/AuthStack.tsx`

**Interfaces:**
- Consumes: `login`(Task 2, `api/auth.ts`), `useAuth`(Task 3), `AuthStackParamList`(Task 4).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/LoginScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import * as authApi from '../api/auth';
import LoginScreen from './LoginScreen';

jest.mock('../api/auth');

function renderLogin() {
  const Stack = createNativeStackNavigator();
  return render(
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup">{() => <Text>signup-screen</Text>}</Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

describe('LoginScreen', () => {
  it('logs in and stores the token on success', async () => {
    (authApi.login as jest.Mock).mockResolvedValueOnce('new-token');
    renderLogin();

    fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'password123');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith('a@b.com', 'password123'));
  });

  it('shows an error message on failure', async () => {
    (authApi.login as jest.Mock).mockRejectedValueOnce(new Error('로그인에 실패했어요'));
    renderLogin();

    fireEvent.changeText(screen.getByTestId('login-email'), 'a@b.com');
    fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');
    fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않아요'));
  });

  it('navigates to signup', async () => {
    renderLogin();
    fireEvent.press(screen.getByText('회원가입'));
    await waitFor(() => expect(screen.getByText('signup-screen')).toBeTruthy());
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd mobile && npx jest src/screens/LoginScreen.test.tsx`
Expected: FAIL — `Cannot find module './LoginScreen'`

- [ ] **Step 3: `LoginScreen.tsx` 구현**

`mobile/src/screens/LoginScreen.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigation = useNavigation<Nav>();

  async function handleSubmit() {
    setError('');
    try {
      const token = await loginApi(email, password);
      await login(token);
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않아요');
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>그로우미</Text>
      <TextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        testID="login-email"
      />
      <TextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />
      <Button title="로그인" onPress={handleSubmit} testID="login-submit" />
      {error ? <Text testID="login-error">{error}</Text> : null}
      <Button title="회원가입" onPress={() => navigation.navigate('Signup')} />
    </View>
  );
}
```

- [ ] **Step 4: `AuthStack.tsx`에서 `LoginPlaceholder`를 `LoginScreen`으로 교체**

`mobile/src/navigation/AuthStack.tsx`의:
```tsx
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

function LoginPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>로그인 화면 준비 중입니다</Text>
    </View>
  );
}
```
을:
```tsx
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};
```
로 교체하고, 아래쪽의:
```tsx
      <Stack.Screen name="Login" component={LoginPlaceholder} />
```
을:
```tsx
      <Stack.Screen name="Login" component={LoginScreen} />
```
로 교체한다. `SignupPlaceholder` 관련 코드는 그대로 둔다(Task 6에서 교체).

- [ ] **Step 5: 실행해 통과 확인**

Run: `cd mobile && npx jest src/screens/LoginScreen.test.tsx`
Expected: PASS (3개 테스트)

Run: `cd mobile && npx jest src/navigation/RootNavigator.test.tsx`
Expected: FAIL — `AuthStack`이 이제 실제 `LoginScreen`을 렌더링해서 "로그인 화면 준비 중입니다" 문구가 더 이상 없음(Task 4 때 만든 placeholder 문구를 찾던 테스트가 깨짐, 다음 스텝에서 고침)

- [ ] **Step 6: `RootNavigator.test.tsx`를 실제 `LoginScreen` 문구에 맞게 수정**

`mobile/src/navigation/RootNavigator.test.tsx`의:
```tsx
    await waitFor(() => expect(screen.getByText('로그인 화면 준비 중입니다')).toBeTruthy());
```
을:
```tsx
    await waitFor(() => expect(screen.getByText('그로우미')).toBeTruthy());
```
로 교체.

- [ ] **Step 7: 다시 실행해 통과 확인**

Run: `cd mobile && npx jest src/navigation/RootNavigator.test.tsx src/screens/LoginScreen.test.tsx`
Expected: PASS (전체)

- [ ] **Step 8: Commit**

```bash
git add mobile/src/screens/LoginScreen.tsx mobile/src/screens/LoginScreen.test.tsx mobile/src/navigation/AuthStack.tsx mobile/src/navigation/RootNavigator.test.tsx
git commit -m "feat: 로그인 화면 추가"
```

---

### Task 6: SignupScreen

**Files:**
- Create: `mobile/src/screens/SignupScreen.tsx`
- Create: `mobile/src/screens/SignupScreen.test.tsx`
- Modify: `mobile/src/navigation/AuthStack.tsx`

**Interfaces:**
- Consumes: `signup`(Task 2, `api/auth.ts`), `useAuth`(Task 3).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/SignupScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../context/AuthContext';
import * as authApi from '../api/auth';
import SignupScreen from './SignupScreen';

jest.mock('../api/auth');

function renderSignup() {
  const Stack = createNativeStackNavigator();
  return render(
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

describe('SignupScreen', () => {
  it('signs up and stores the token on success', async () => {
    (authApi.signup as jest.Mock).mockResolvedValueOnce('new-token');
    renderSignup();

    fireEvent.changeText(screen.getByTestId('signup-email'), 'a@b.com');
    fireEvent.changeText(screen.getByTestId('signup-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('signup-nickname'), '테스터');
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() =>
      expect(authApi.signup).toHaveBeenCalledWith('a@b.com', 'password123', '테스터')
    );
  });

  it('shows an error message on failure', async () => {
    (authApi.signup as jest.Mock).mockRejectedValueOnce(new Error('회원가입에 실패했어요'));
    renderSignup();

    fireEvent.changeText(screen.getByTestId('signup-email'), 'a@b.com');
    fireEvent.changeText(screen.getByTestId('signup-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('signup-nickname'), '테스터');
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('signup-error')).toHaveTextContent('회원가입에 실패했어요')
    );
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd mobile && npx jest src/screens/SignupScreen.test.tsx`
Expected: FAIL — `Cannot find module './SignupScreen'`

- [ ] **Step 3: `SignupScreen.tsx` 구현**

`mobile/src/screens/SignupScreen.tsx`:
```tsx
import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { signup as signupApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  async function handleSubmit() {
    setError('');
    try {
      const token = await signupApi(email, password, nickname);
      await login(token);
    } catch {
      setError('회원가입에 실패했어요');
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>회원가입</Text>
      <TextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        testID="signup-email"
      />
      <TextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="signup-password"
      />
      <TextInput
        placeholder="닉네임"
        value={nickname}
        onChangeText={setNickname}
        testID="signup-nickname"
      />
      <Button title="가입하기" onPress={handleSubmit} testID="signup-submit" />
      {error ? <Text testID="signup-error">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 4: `AuthStack.tsx`에서 `SignupPlaceholder`를 `SignupScreen`으로 교체**

`mobile/src/navigation/AuthStack.tsx`의 `SignupPlaceholder` 함수 정의를 삭제하고, 상단 import에:
```tsx
import SignupScreen from '../screens/SignupScreen';
```
추가. 그리고:
```tsx
      <Stack.Screen name="Signup" component={SignupPlaceholder} />
```
을:
```tsx
      <Stack.Screen name="Signup" component={SignupScreen} />
```
로 교체.

- [ ] **Step 5: `LoginScreen.test.tsx`의 signup 네비게이션 테스트를 실제 화면 문구로 수정**

`mobile/src/screens/LoginScreen.test.tsx`의 `renderLogin` 함수에서:
```tsx
        <Stack.Screen name="Signup">{() => <Text>signup-screen</Text>}</Stack.Screen>
```
을 삭제하고(더 이상 필요 없음 — 실제 `SignupScreen`이 렌더링되게 둠):
```tsx
import SignupScreen from './SignupScreen';
```
을 import 목록에 추가한 뒤,
```tsx
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup">{() => <Text>signup-screen</Text>}</Stack.Screen>
        </Stack.Navigator>
```
를:
```tsx
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </Stack.Navigator>
```
로 교체하고, 마지막 테스트(`navigates to signup`)의 검증부:
```tsx
    await waitFor(() => expect(screen.getByText('signup-screen')).toBeTruthy());
```
을:
```tsx
    await waitFor(() => expect(screen.getByText('회원가입')).toBeTruthy());
```
로 교체. 파일 상단의:
```tsx
import { Text } from 'react-native';
```
줄은 더 이상 쓰이지 않으므로 삭제한다.

- [ ] **Step 6: 실행해 통과 확인**

Run: `cd mobile && npx jest src/screens/SignupScreen.test.tsx src/screens/LoginScreen.test.tsx`
Expected: PASS (전체)

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/SignupScreen.tsx mobile/src/screens/SignupScreen.test.tsx mobile/src/navigation/AuthStack.tsx mobile/src/screens/LoginScreen.test.tsx
git commit -m "feat: 회원가입 화면 추가"
```

---

### Task 7: 로그아웃 배선 + `App.tsx` 조립 + 최종 회귀

**Files:**
- Modify: `mobile/src/screens/ProfileScreen.tsx`
- Create: `mobile/src/screens/ProfileScreen.test.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: `useAuth`(Task 3, `logout()`), `AuthProvider`(Task 3), `RootNavigator`(Task 4).

- [ ] **Step 1: 실패하는 테스트 작성**

`mobile/src/screens/ProfileScreen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import ProfileScreen from './ProfileScreen';

describe('ProfileScreen', () => {
  it('logs out when the button is pressed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('logout-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('growme_token'));
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `cd mobile && npx jest src/screens/ProfileScreen.test.tsx`
Expected: FAIL — `getByTestId('logout-button')`를 찾지 못함(현재 `ProfileScreen`에 버튼이 없음)

- [ ] **Step 3: `ProfileScreen.tsx`에 로그아웃 버튼 추가**

`mobile/src/screens/ProfileScreen.tsx` 전체를:
```tsx
import { View, Text, Button } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
      <Button title="로그아웃" onPress={() => logout()} testID="logout-button" />
    </View>
  );
}
```
로 교체.

- [ ] **Step 4: 실행해 통과 확인**

Run: `cd mobile && npx jest src/screens/ProfileScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: `App.tsx`를 `AuthProvider` + `RootNavigator`로 교체**

`mobile/App.tsx` 전체를:
```tsx
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
```
로 교체.

- [ ] **Step 6: 전체 테스트 스위트 + 타입체크 실행**

Run: `cd mobile && npx jest`
Expected: 전부 PASS

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 백엔드 기동 후 실기기/에뮬레이터에서 수동 확인 (사람이 수행)**

1. `cd backend && npm run dev`로 백엔드를 띄운다(Postgres가 떠 있어야 함).
2. `mobile/app.json`의 `expo.extra.apiBase`를 자신의 개발 머신 LAN IP로 맞춘다.
3. `cd mobile && npx expo start`로 개발 서버를 띄우고 iOS 시뮬레이터 또는 Android 에뮬레이터(또는 Expo Go로 실기기)에서 연다.
4. 회원가입 → 자동 로그인되어 하단 탭(홈/히스토리/프로필)이 보이는지 확인.
5. 탭 3개를 오가며 각 placeholder 문구가 보이는지 확인.
6. 프로필 탭에서 로그아웃 → 로그인 화면으로 돌아가는지 확인.
7. 앱을 완전히 종료했다가 다시 열었을 때, 로그아웃 전이면 탭 화면으로 바로 진입하는지(토큰 영속) 확인.

Expected: 위 항목 전부 정상 동작.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/screens/ProfileScreen.tsx mobile/src/screens/ProfileScreen.test.tsx mobile/App.tsx
git commit -m "feat: 로그아웃 배선 + App.tsx 조립"
```
