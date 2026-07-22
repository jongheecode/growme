import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as leaderboardApi from '../api/leaderboard';
import * as usersApi from '../api/users';
import * as safetyApi from '../api/safety';
import LeaderboardScreen from './LeaderboardScreen';

jest.mock('../api/leaderboard');
jest.mock('../api/users');
jest.mock('../api/safety');

const globalAlltime: leaderboardApi.LeaderboardEntry[] = [
  { userId: 'u1', nickname: '철수', totalXp: 100, rank: 1 },
  { userId: 'u2', nickname: '영희', totalXp: 50, rank: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue(globalAlltime);
  (usersApi.getMe as jest.Mock).mockResolvedValue({
    id: 'u1',
    email: 'me@example.com',
    nickname: '철수',
    bio: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
});

describe('LeaderboardScreen', () => {
  it('loads the global/alltime leaderboard by default', async () => {
    render(<LeaderboardScreen />);
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith('global', 'alltime'));
    expect(screen.getByText(/철수/)).toBeTruthy();
    expect(screen.getByText(/영희/)).toBeTruthy();
  });

  it('reloads with scope=friends when the friends toggle is pressed', async () => {
    render(<LeaderboardScreen />);
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith('global', 'alltime'));

    fireEvent.press(screen.getByTestId('scope-friends'));
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith('friends', 'alltime'));
  });

  it('reloads with range=weekly when the weekly toggle is pressed', async () => {
    render(<LeaderboardScreen />);
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith('global', 'alltime'));

    fireEvent.press(screen.getByTestId('range-weekly'));
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith('global', 'weekly'));
  });

  it('hides the actions menu on my own row', async () => {
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-actions-u2')).toBeTruthy());
    expect(screen.queryByTestId('leaderboard-actions-u1')).toBeNull();
  });

  it('blocks another user from the actions menu', async () => {
    (safetyApi.blockUser as jest.Mock).mockResolvedValueOnce(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === '차단')?.onPress?.();
    });
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-actions-u2')).toBeTruthy());

    fireEvent.press(screen.getByTestId('leaderboard-actions-u2'));
    await waitFor(() => expect(safetyApi.blockUser).toHaveBeenCalledWith('u2'));
  });

  it('reports another user with a chosen reason from the actions menu', async () => {
    (safetyApi.reportUser as jest.Mock).mockResolvedValueOnce(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === '영희') {
        buttons?.find((b) => b.text === '신고')?.onPress?.();
      } else {
        buttons?.find((b) => b.text === '괴롭힘')?.onPress?.();
      }
    });
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-actions-u2')).toBeTruthy());

    fireEvent.press(screen.getByTestId('leaderboard-actions-u2'));
    await waitFor(() => expect(safetyApi.reportUser).toHaveBeenCalledWith('u2', '괴롭힘'));
  });

  it('shows an error with a retry button on load failure', async () => {
    (leaderboardApi.getLeaderboard as jest.Mock).mockRejectedValueOnce(new Error('랭킹을 불러오지 못했어요'));
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('leaderboard-retry'));
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(2));
  });
});
