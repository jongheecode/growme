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
