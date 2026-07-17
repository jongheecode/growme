import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as goalsApi from '../api/goals';
import OnboardingChatScreen from './OnboardingChatScreen';

const mockRefreshGoals = jest.fn();

jest.mock('../api/goals');
jest.mock('../context/GoalsContext', () => ({
  useGoals: () => ({ refreshGoals: mockRefreshGoals }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OnboardingChatScreen', () => {
  it('sends a message and appends the assistant reply', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({ reply: '요즘 어때?', goalSet: false });
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '안녕');
    fireEvent.press(screen.getByTestId('chat-send'));

    await waitFor(() => expect(screen.getByTestId('chat-message-1')).toHaveTextContent('요즘 어때?'));
    expect(goalsApi.sendGoalChatMessage).toHaveBeenCalledWith([{ role: 'user', content: '안녕' }]);
  });

  it('shows the confirmation screen and refreshes goals when a goal is set', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({
      reply: '좋아!',
      goalSet: true,
      goal: { id: 'g1', title: '매일 달리기', category: 'EXERCISE', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '운동 습관 만들고 싶어');
    fireEvent.press(screen.getByTestId('chat-send'));

    await waitFor(() => expect(screen.getByTestId('goal-confirmed')).toHaveTextContent('매일 달리기'));
    expect(mockRefreshGoals).toHaveBeenCalled();
  });

  it('shows a retry button on failure and resends the same last message without duplicating it', async () => {
    (goalsApi.sendGoalChatMessage as jest.Mock).mockRejectedValueOnce(new Error('메시지를 보내지 못했어요'));
    render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);

    fireEvent.changeText(screen.getByTestId('chat-input'), '안녕');
    fireEvent.press(screen.getByTestId('chat-send'));
    await waitFor(() => expect(screen.getByTestId('chat-error')).toBeTruthy());

    (goalsApi.sendGoalChatMessage as jest.Mock).mockResolvedValueOnce({ reply: '다시 왔네', goalSet: false });
    fireEvent.press(screen.getByTestId('chat-retry'));

    await waitFor(() => expect(screen.getByTestId('chat-message-1')).toHaveTextContent('다시 왔네'));
    expect(goalsApi.sendGoalChatMessage).toHaveBeenLastCalledWith([{ role: 'user', content: '안녕' }]);
  });

  it('shows a cancel button only when canCancel is true', () => {
    const { rerender } = render(<OnboardingChatScreen canCancel={false} onDone={() => {}} />);
    expect(screen.queryByTestId('onboarding-cancel')).toBeNull();

    rerender(<OnboardingChatScreen canCancel onDone={() => {}} />);
    expect(screen.getByTestId('onboarding-cancel')).toBeTruthy();
  });

  it('calls onDone when the cancel button is pressed', () => {
    const onDone = jest.fn();
    render(<OnboardingChatScreen canCancel onDone={onDone} />);
    fireEvent.press(screen.getByTestId('onboarding-cancel'));
    expect(onDone).toHaveBeenCalled();
  });
});
