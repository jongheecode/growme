import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as historyApi from '../api/history';
import HistoryScreen from './HistoryScreen';

jest.mock('../api/history');

const completedEntry: historyApi.HistoryEntry = {
  id: '1',
  title: '운동하기',
  category: 'EXERCISE',
  difficulty: 'EASY',
  status: 'COMPLETED',
  xpValue: 10,
  occurredAt: '2026-07-10T12:00:00.000Z',
  focusSeconds: 125,
};

const failedEntry: historyApi.HistoryEntry = {
  id: '2',
  title: '독서하기',
  category: 'READING',
  difficulty: 'MEDIUM',
  status: 'FAILED',
  xpValue: 20,
  occurredAt: '2026-07-09T12:00:00.000Z',
  focusSeconds: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HistoryScreen', () => {
  it('loads history on mount and shows entries', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([completedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
    expect(historyApi.getTaskHistory).toHaveBeenCalled();
    expect(screen.getByText(/운동하기/)).toBeTruthy();
  });

  it('shows an empty-state message when there is no history', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('아직 기록이 없어요')).toBeTruthy());
  });

  it('shows the XP earned for a completed entry', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([completedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('+10XP')).toBeTruthy());
  });

  it('does not show an XP label for a failed entry', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([failedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText(/독서하기/)).toBeTruthy());
    expect(screen.queryByText('+20XP')).toBeNull();
  });

  it('shows the formatted focus time when focusSeconds is greater than 0', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([completedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('02:05')).toBeTruthy());
  });

  it('does not show a focus time label when focusSeconds is 0', async () => {
    (historyApi.getTaskHistory as jest.Mock).mockResolvedValue([failedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText(/독서하기/)).toBeTruthy());
    expect(screen.queryByText('00:00')).toBeNull();
  });

  it('shows an error with a retry button on load failure, and reloads on press', async () => {
    (historyApi.getTaskHistory as jest.Mock)
      .mockRejectedValueOnce(new Error('히스토리를 불러오지 못했어요'))
      .mockResolvedValueOnce([completedEntry]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByTestId('history-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('history-retry'));
    await waitFor(() => expect(screen.getByTestId('history-list')).toBeTruthy());
  });
});
