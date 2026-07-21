import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from '../api/tasks';
import * as growthApi from '../api/growth';
import * as shopApi from '../api/shop';
import HomeScreen from './HomeScreen';

jest.mock('../api/tasks');
jest.mock('../api/growth');
jest.mock('../api/shop');
import * as goalsApi from '../api/goals';
jest.mock('../api/goals');
jest.mock('../api/sessions');

const mockSetActiveGoalId = jest.fn();
const mockUseGoals = jest.fn();
jest.mock('../context/GoalsContext', () => ({
  useGoals: () => mockUseGoals(),
}));

const growthState: growthApi.GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: null,
  points: 0,
};

const taskInGoalA: tasksApi.Task = {
  id: '1',
  title: '운동하기',
  category: 'EXERCISE',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: 'goal-a',
  reactionText: null,
  reactionShownAt: null,
};

const taskInGoalB: tasksApi.Task = {
  id: '2',
  title: '독서하기',
  category: 'READING',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
  goalId: 'goal-b',
  reactionText: null,
  reactionShownAt: null,
};

const goals = [
  { id: 'goal-a', title: '운동 목표', category: 'EXERCISE' as const, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'goal-b', title: '독서 목표', category: 'READING' as const, createdAt: '2026-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalA, taskInGoalB]);
  (growthApi.getGrowth as jest.Mock).mockResolvedValue(growthState);
  (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED' });
  (tasksApi.createTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, id: '3', title: '새 할일' });
  mockUseGoals.mockReturnValue({ goals, activeGoalId: 'goal-a', setActiveGoalId: mockSetActiveGoalId });
  (goalsApi.suggestTasks as jest.Mock).mockResolvedValue([]);
  (tasksApi.ackReaction as jest.Mock).mockResolvedValue(undefined);
  (shopApi.getMyAccessories as jest.Mock).mockResolvedValue([]);
});

describe('HomeScreen', () => {
  it('loads growth and tasks on mount and shows the kkumi', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
    expect(growthApi.getGrowth).toHaveBeenCalled();
    expect(tasksApi.listTasks).toHaveBeenCalled();
  });

  it('opens the info modal when the kkumi is tapped', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
    fireEvent.press(screen.getByTestId('kkumi-tap-target'));
    expect(screen.getByTestId('kkumi-species-label')).toBeTruthy();
  });

  it("shows only the active goal's tasks in the task sheet", async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText(/운동하기/)).toBeTruthy();
    expect(screen.queryByText(/독서하기/)).toBeNull();
  });

  it('switches the active goal when a chip is pressed', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('goal-chip-goal-b')).toBeTruthy());
    fireEvent.press(screen.getByTestId('goal-chip-goal-b'));
    expect(mockSetActiveGoalId).toHaveBeenCalledWith('goal-b');
  });

  it('completes a task from the sheet and refreshes growth', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(growthApi.getGrowth).toHaveBeenCalledTimes(2));
  });

  it('creates a task from the sheet form tagged with the active goal', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '새 할일');
    fireEvent.press(screen.getByTestId('add-task-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('새 할일', 'ETC', 'EASY', 'TODAY', 'goal-a')
    );
    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(2));
  });

  it('shows a retry button when the initial load fails, and reloads on press', async () => {
    (growthApi.getGrowth as jest.Mock).mockRejectedValueOnce(new Error('불러오지 못했어요'));
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('home-retry')).toBeTruthy());

    fireEvent.press(screen.getByTestId('home-retry'));
    await waitFor(() => expect(screen.getByTestId('kkumi-tap-target')).toBeTruthy());
  });

  it('keeps the expired-task message visible after the post-failure refresh completes', async () => {
    (tasksApi.completeTask as jest.Mock).mockRejectedValueOnce(new Error('이미 기한이 지났습니다'));
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));

    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('home-error')).toHaveTextContent('이미 기한이 지났습니다');
  });

  it('shows an immediate reaction modal after completing a task', async () => {
    (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED', reactionText: '잘했어!' });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('잘했어!'));
  });

  it('does not show a reaction modal when completeTask returns no reactionText', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalled());
    expect(screen.queryByTestId('reaction-modal')).toBeNull();
  });

  it('shows a queued reaction for a pending FAILED task on load, and acks it on dismiss', async () => {
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([
      { ...taskInGoalA, status: 'FAILED', reactionText: '괜찮아, 다음엔 잘할 거야', reactionShownAt: null },
    ]);
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('괜찮아, 다음엔 잘할 거야'));
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('아쉬워요');

    fireEvent.press(screen.getByTestId('reaction-modal-dismiss'));
    await waitFor(() => expect(tasksApi.ackReaction).toHaveBeenCalledWith('1'));
  });

  it('requests suggestions automatically when switching to a goal with no tasks', async () => {
    mockUseGoals.mockReturnValue({ goals, activeGoalId: 'goal-a', setActiveGoalId: mockSetActiveGoalId });
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalB]);
    render(<HomeScreen />);
    await waitFor(() => expect(goalsApi.suggestTasks).toHaveBeenCalledWith('goal-a'));
  });

  it('does not request suggestions when the active goal already has tasks', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    expect(goalsApi.suggestTasks).not.toHaveBeenCalled();
  });

  it('accepts a suggestion, creating a task and clearing the card', async () => {
    (goalsApi.suggestTasks as jest.Mock).mockResolvedValue([
      { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'TODAY' },
    ]);
    (tasksApi.listTasks as jest.Mock).mockResolvedValue([taskInGoalB]);
    render(<HomeScreen />);
    await waitFor(() => expect(goalsApi.suggestTasks).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('task-fab'));
    await waitFor(() => expect(screen.getByText(/단어 암기/)).toBeTruthy());
    fireEvent.press(screen.getByTestId('suggestion-accept-0'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('단어 암기', 'STUDY', 'MEDIUM', 'TODAY', 'goal-a')
    );
  });

  it('opens the mission modal when a task row is tapped', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    expect(screen.getByTestId('mission-modal')).toBeTruthy();
  });

  it('closes the mission modal without completing the task', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    fireEvent.press(screen.getByTestId('mission-close'));
    await waitFor(() => expect(screen.queryByTestId('mission-modal')).toBeNull());
    expect(tasksApi.completeTask).not.toHaveBeenCalled();
  });

  it('shows the current point balance', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('points-badge')).toHaveTextContent('0 P'));
  });

  it('passes equipped accessories to the kkumi view', async () => {
    (shopApi.getMyAccessories as jest.Mock).mockResolvedValue([{ itemId: 'i1', slot: 'HAT', key: 'ribbon' }]);
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('accessory-badge-HAT')).toBeTruthy());
  });

  it('completes a task from the mission modal and shows the reaction', async () => {
    (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...taskInGoalA, status: 'COMPLETED', reactionText: '잘했어!' });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-row-1'));
    fireEvent.press(screen.getByTestId('mission-complete'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(screen.getByTestId('reaction-text')).toHaveTextContent('잘했어!'));
    expect(screen.queryByTestId('mission-modal')).toBeNull();
  });
});
