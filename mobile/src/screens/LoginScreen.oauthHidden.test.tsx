import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../context/AuthContext';
import LoginScreen from './LoginScreen';

jest.mock('../api/auth');
jest.mock('../oauth');

// jest.setup.ts의 기본 expo-constants 목은 googleClientId/kakaoClientId가
// 빈 문자열이라, client ID 미설정 상태에서 구글/카카오 버튼이 실제로
// 숨겨지는지 확인한다.
describe('LoginScreen (OAuth not configured)', () => {
  it('hides the google/kakao buttons when no client ID is configured', () => {
    const Stack = createNativeStackNavigator();
    render(
      <AuthProvider>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    );

    expect(screen.queryByTestId('login-google')).toBeNull();
    expect(screen.queryByTestId('login-kakao')).toBeNull();
  });
});
