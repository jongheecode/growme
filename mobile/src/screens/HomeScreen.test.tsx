import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from '../api/tasks';
import * as growthApi from '../api/growth';
import HomeScreen from './HomeScreen';

jest.mock('../api/tasks');
jest.mock('../api/growth');

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
});
