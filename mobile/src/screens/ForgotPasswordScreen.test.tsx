import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import * as authApi from '../api/auth';
import ForgotPasswordScreen from './ForgotPasswordScreen';

jest.mock('../api/auth');

function DummyLogin() {
  return (
    <View>
      <Text testID="dummy-login">login</Text>
    </View>
  );
}

function renderScreen() {
  const Stack = createNativeStackNavigator();
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Login" component={DummyLogin} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

describe('ForgotPasswordScreen', () => {
  it('requests a reset link and reveals the token/new-password fields', async () => {
    (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByTestId('forgot-email'), 'a@b.com');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(authApi.forgotPassword).toHaveBeenCalledWith('a@b.com'));
    await waitFor(() => expect(screen.getByTestId('reset-token')).toBeTruthy());
  });

  it('shows an error when the request fails', async () => {
    (authApi.forgotPassword as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderScreen();

    fireEvent.changeText(screen.getByTestId('forgot-email'), 'a@b.com');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    await waitFor(() => expect(screen.getByTestId('forgot-error')).toBeTruthy());
  });

  it('resets the password with a token and shows the done state', async () => {
    (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
    (authApi.resetPassword as jest.Mock).mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByTestId('forgot-email'), 'a@b.com');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await waitFor(() => expect(screen.getByTestId('reset-token')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('reset-token'), 'abc123');
    fireEvent.changeText(screen.getByTestId('reset-new-password'), 'newpassword456');
    fireEvent.press(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith('abc123', 'newpassword456'));
    await waitFor(() => expect(screen.getByTestId('reset-done')).toBeTruthy());
  });

  it('shows an error when the reset token is invalid', async () => {
    (authApi.forgotPassword as jest.Mock).mockResolvedValueOnce(undefined);
    (authApi.resetPassword as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderScreen();

    fireEvent.changeText(screen.getByTestId('forgot-email'), 'a@b.com');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await waitFor(() => expect(screen.getByTestId('reset-token')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('reset-token'), 'bad-token');
    fireEvent.changeText(screen.getByTestId('reset-new-password'), 'newpassword456');
    fireEvent.press(screen.getByTestId('reset-submit'));

    await waitFor(() => expect(screen.getByTestId('forgot-error')).toBeTruthy());
  });

  it('navigates back to login', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('forgot-back-to-login'));
    await waitFor(() => expect(screen.getByTestId('dummy-login')).toBeTruthy());
  });
});
