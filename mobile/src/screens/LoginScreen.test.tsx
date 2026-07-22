import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import * as authApi from '../api/auth';
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';

jest.mock('../api/auth');

function DummyForgotPassword() {
  return (
    <View>
      <Text testID="dummy-forgot-password">forgot password</Text>
    </View>
  );
}

function renderLogin() {
  const Stack = createNativeStackNavigator();
  return render(
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={DummyForgotPassword} />
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
    await waitFor(() => expect(screen.getByText('회원가입')).toBeTruthy());
  });

  it('navigates to the forgot password screen', async () => {
    renderLogin();
    fireEvent.press(screen.getByTestId('login-forgot-password'));
    await waitFor(() => expect(screen.getByTestId('dummy-forgot-password')).toBeTruthy());
  });
});
