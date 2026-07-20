import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as leaderboardApi from '../api/leaderboard';
import LeaderboardScreen from './LeaderboardScreen';

jest.mock('../api/leaderboard');

const globalAlltime: leaderboardApi.LeaderboardEntry[] = [
  { userId: 'u1', nickname: '철수', totalXp: 100, rank: 1 },
  { userId: 'u2', nickname: '영희', totalXp: 50, rank: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (leaderboardApi.getLeaderboard as jest.Mock).mockResolvedValue(globalAlltime);
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

  it('shows an error with a retry button on load failure', async () => {
    (leaderboardApi.getLeaderboard as jest.Mock).mockRejectedValueOnce(new Error('랭킹을 불러오지 못했어요'));
    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('leaderboard-retry'));
    await waitFor(() => expect(leaderboardApi.getLeaderboard).toHaveBeenCalledTimes(2));
  });
});
