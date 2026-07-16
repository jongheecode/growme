import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { token, isLoading, login, logout } = useAuth();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text testID="token">{token ?? 'no-token'}</Text>
      <Text onPress={() => login('new-token')}>login</Text>
      <Text onPress={() => logout()}>logout</Text>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
