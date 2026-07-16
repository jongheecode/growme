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
    await waitFor(() => expect(screen.getByText('그로우미')).toBeTruthy());
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
