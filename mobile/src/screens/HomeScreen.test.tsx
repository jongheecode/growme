import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as tasksApi from '../api/tasks';
import * as growthApi from '../api/growth';
import HomeScreen from './HomeScreen';

jest.mock('../api/tasks');
jest.mock('../api/growth');

const growthState: growthApi.GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: null,
};

const task: tasksApi.Task = {
  id: '1',
  title: '운동하기',
  category: 'EXERCISE',
  difficulty: 'EASY',
  xpValue: 10,
  dueAt: new Date().toISOString(),
  status: 'PENDING',
  completedAt: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (tasksApi.listTasks as jest.Mock).mockResolvedValue([task]);
  (growthApi.getGrowth as jest.Mock).mockResolvedValue(growthState);
  (tasksApi.completeTask as jest.Mock).mockResolvedValue({ ...task, status: 'COMPLETED' });
  (tasksApi.createTask as jest.Mock).mockResolvedValue({ ...task, id: '2', title: '새 할일' });
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

  it('completes a task from the sheet and refreshes growth', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    await waitFor(() => expect(tasksApi.completeTask).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(growthApi.getGrowth).toHaveBeenCalledTimes(2));
  });

  it('creates a task from the sheet form and refreshes the list', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('task-fab')).toBeTruthy());
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '새 할일');
    fireEvent.press(screen.getByTestId('add-task-submit'));
    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith('새 할일', 'ETC', 'EASY', 'TODAY')
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
