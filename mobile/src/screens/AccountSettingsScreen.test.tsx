import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as authApi from '../api/auth';
import * as usersApi from '../api/users';
import { AuthProvider } from '../context/AuthContext';
import AccountSettingsScreen from './AccountSettingsScreen';

jest.mock('../api/auth');
jest.mock('../api/users');

beforeEach(() => {
  jest.clearAllMocks();
  (usersApi.getMe as jest.Mock).mockResolvedValue({
    id: 'u1',
    email: 'old@example.com',
    nickname: '종이',
    bio: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
});

function renderScreen() {
  return render(
    <AuthProvider>
      <AccountSettingsScreen />
    </AuthProvider>
  );
}

describe('AccountSettingsScreen', () => {
  it('loads the current email into the field', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('settings-email-input').props.value).toBe('old@example.com'));
  });

  it('updates the email successfully', async () => {
    (usersApi.updateEmail as jest.Mock).mockResolvedValueOnce({});
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('settings-email-input').props.value).toBe('old@example.com'));

    fireEvent.changeText(screen.getByTestId('settings-email-input'), 'new@example.com');
    fireEvent.press(screen.getByTestId('settings-email-submit'));

    await waitFor(() => expect(usersApi.updateEmail).toHaveBeenCalledWith('new@example.com'));
    await waitFor(() => expect(screen.getByTestId('settings-email-message')).toBeTruthy());
  });

  it('shows an error when the email is already in use', async () => {
    (usersApi.updateEmail as jest.Mock).mockRejectedValueOnce(new Error('이미 사용 중인 이메일이에요'));
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('settings-email-input')).toBeTruthy());

    fireEvent.press(screen.getByTestId('settings-email-submit'));
    await waitFor(() => expect(screen.getByTestId('settings-email-error')).toHaveTextContent('이미 사용 중인 이메일이에요'));
  });

  it('changes the password successfully', async () => {
    (authApi.changePassword as jest.Mock).mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByTestId('settings-current-password'), 'oldpass123');
    fireEvent.changeText(screen.getByTestId('settings-new-password'), 'newpass456');
    fireEvent.press(screen.getByTestId('settings-password-submit'));

    await waitFor(() => expect(authApi.changePassword).toHaveBeenCalledWith('oldpass123', 'newpass456'));
    await waitFor(() => expect(screen.getByTestId('settings-password-message')).toBeTruthy());
  });

  it('shows an error when the current password is wrong', async () => {
    (authApi.changePassword as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderScreen();

    fireEvent.press(screen.getByTestId('settings-password-submit'));
    await waitFor(() => expect(screen.getByTestId('settings-password-error')).toBeTruthy());
  });

  it('deletes the account after confirming the alert', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
    (usersApi.deleteAccount as jest.Mock).mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.press(screen.getByTestId('settings-delete-account'));
    await waitFor(() => expect(usersApi.deleteAccount).toHaveBeenCalled());
  });

  it('shows an error when account deletion fails', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });
    (usersApi.deleteAccount as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderScreen();

    fireEvent.press(screen.getByTestId('settings-delete-account'));
    await waitFor(() => expect(screen.getByTestId('settings-delete-error')).toBeTruthy());
  });
});
