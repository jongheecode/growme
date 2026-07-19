import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import MissionModal from './MissionModal';
import { Task } from '../api/tasks';
import * as sessionsApi from '../api/sessions';

jest.mock('../api/sessions');

const pendingTask: Task = {
  id: '1',
  title: '리스닝 20분',
  category: 'STUDY',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: null,
  reactionText: null,
  reactionShownAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (sessionsApi.startTaskSession as jest.Mock).mockResolvedValue({ id: 'session-1', startedAt: new Date().toISOString() });
  (sessionsApi.sendHeartbeat as jest.Mock).mockResolvedValue({ verifiedSeconds: 0 });
  (sessionsApi.endSession as jest.Mock).mockResolvedValue({ verifiedSeconds: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MissionModal', () => {
  it('renders nothing when task is null', () => {
    render(<MissionModal task={null} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.queryByTestId('mission-modal')).toBeNull();
  });

  it('shows task title and a zeroed timer for a pending task', () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByTestId('mission-title')).toHaveTextContent('리스닝 20분');
    expect(screen.getByTestId('mission-timer')).toHaveTextContent('00:00');
  });

  it('starts the timer and ticks the elapsed display', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalledWith('1'));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('mission-timer')).toHaveTextContent('00:03');
  });

  it('sends a heartbeat every 30 seconds while the timer runs', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(sessionsApi.sendHeartbeat).toHaveBeenCalledWith('session-1');
  });

  it('stops the timer and ends the session', async () => {
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(screen.getByTestId('mission-timer-stop')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-stop'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(screen.getByTestId('mission-timer-start')).toBeTruthy();
  });

  it('ends the running session and calls onComplete when completed', async () => {
    const onComplete = jest.fn();
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={onComplete} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-complete'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('calls onComplete without ending a session when the timer was never started', async () => {
    const onComplete = jest.fn();
    render(<MissionModal task={pendingTask} onClose={() => {}} onComplete={onComplete} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-complete'));
    });
    expect(sessionsApi.endSession).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('ends the running session and calls onClose when closed', async () => {
    const onClose = jest.fn();
    render(<MissionModal task={pendingTask} onClose={onClose} onComplete={() => {}} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-timer-start'));
    });
    await waitFor(() => expect(sessionsApi.startTaskSession).toHaveBeenCalled());
    await act(async () => {
      fireEvent.press(screen.getByTestId('mission-close'));
    });
    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a status label without timer controls for a completed task', () => {
    render(<MissionModal task={{ ...pendingTask, status: 'COMPLETED' }} onClose={() => {}} onComplete={() => {}} />);
    expect(screen.getByTestId('mission-status')).toHaveTextContent('완료됨');
    expect(screen.queryByTestId('mission-timer-start')).toBeNull();
  });
});
