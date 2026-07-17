import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import { GoalsProvider } from '../context/GoalsContext';
import * as goalsApi from '../api/goals';
import RootNavigator from './RootNavigator';

jest.mock('../api/goals');

function renderRoot() {
  return render(
    <AuthProvider>
      <GoalsProvider>
        <RootNavigator />
      </GoalsProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RootNavigator', () => {
  it('shows the auth stack when there is no stored token', async () => {
    renderRoot();
    await waitFor(() => expect(screen.getByText('그로우미')).toBeTruthy());
  });

  it('shows the onboarding chat without a cancel button when logged in with no goals', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([]);
    renderRoot();
    await waitFor(() => expect(screen.getByTestId('chat-input')).toBeTruthy());
    expect(screen.queryByTestId('onboarding-cancel')).toBeNull();
  });

  it('shows the main tabs when logged in with at least one goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([
      { id: 'g1', title: '목표', category: 'ETC', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('no network in this test'))) as unknown as typeof fetch;
    renderRoot();
    await waitFor(() => expect(screen.getByText('히스토리')).toBeTruthy());
  });

  it('shows a cancelable onboarding chat when adding a goal from the profile tab', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockResolvedValueOnce([
      { id: 'g1', title: '목표', category: 'ETC', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('no network in this test'))) as unknown as typeof fetch;
    renderRoot();
    await waitFor(() => expect(screen.getByText('히스토리')).toBeTruthy());

    fireEvent.press(screen.getByText('프로필'));
    await waitFor(() => expect(screen.getByTestId('add-goal-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('add-goal-button'));

    await waitFor(() => expect(screen.getByTestId('onboarding-cancel')).toBeTruthy());
  });

  it('shows a retry view when the initial goals load fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    (goalsApi.listGoals as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    renderRoot();
    await waitFor(() => expect(screen.getByTestId('goals-retry')).toBeTruthy());
  });
});
