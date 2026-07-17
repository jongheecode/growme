import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import ProfileScreen from './ProfileScreen';

const mockStartAddGoal = jest.fn();

jest.mock('../context/GoalsContext', () => ({
  useGoals: () => ({ startAddGoal: mockStartAddGoal }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

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

  it('starts adding a goal when the button is pressed', async () => {
    render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('add-goal-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('add-goal-button'));
    expect(mockStartAddGoal).toHaveBeenCalled();
  });
});
