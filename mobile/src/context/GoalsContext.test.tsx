import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from './AuthContext';
import { GoalsProvider, useGoals } from './GoalsContext';
import * as goalsApi from '../api/goals';

jest.mock('../api/goals');

function Probe() {
  const { goals, isLoading, error, activeGoalId, setActiveGoalId, isAddingGoal, startAddGoal, stopAddGoal, refreshGoals } =
    useGoals();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text testID="goal-count">{goals.length}</Text>
      <Text testID="active-goal">{activeGoalId ?? 'none'}</Text>
      <Text testID="adding">{isAddingGoal ? 'yes' : 'no'}</Text>
      <Text testID="goals-error">{error}</Text>
      <Text onPress={() => setActiveGoalId('g1')}>select-g1</Text>
      <Text onPress={() => startAddGoal()}>start-add</Text>
      <Text onPress={() => stopAddGoal()}>stop-add</Text>
      <Text onPress={() => refreshGoals()}>refresh</Text>
    </>
  );
}

const goalsList = [
  { id: 'g2', title: '두번째', category: 'STUDY' as const, createdAt: '2026-01-02T00:00:00.000Z' },
  { id: 'g1', title: '첫번째', category: 'ETC' as const, createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('GoalsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (goalsApi.listGoals as jest.Mock).mockResolvedValue(goalsList);
  });

  it('loads goals and defaults activeGoalId to the newest goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    expect(screen.getByTestId('active-goal')).toHaveTextContent('g2');
  });

  it('setActiveGoalId changes the active goal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    await act(async () => {
      screen.getByText('select-g1').props.onPress();
    });
    expect(screen.getByTestId('active-goal')).toHaveTextContent('g1');
  });

  it('startAddGoal/stopAddGoal toggle isAddingGoal', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));
    await act(async () => {
      screen.getByText('start-add').props.onPress();
    });
    expect(screen.getByTestId('adding')).toHaveTextContent('yes');
    await act(async () => {
      screen.getByText('stop-add').props.onPress();
    });
    expect(screen.getByTestId('adding')).toHaveTextContent('no');
  });

  it('has no goals and does not call listGoals when there is no token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('0'));
    expect(goalsApi.listGoals).not.toHaveBeenCalled();
  });

  it('keeps the previously loaded goals and surfaces an error when a later refresh fails', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stored-token');
    render(
      <AuthProvider>
        <GoalsProvider>
          <Probe />
        </GoalsProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('goal-count')).toHaveTextContent('2'));

    (goalsApi.listGoals as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      screen.getByText('refresh').props.onPress();
    });

    expect(screen.getByTestId('goal-count')).toHaveTextContent('2');
    expect(screen.getByTestId('goals-error')).toHaveTextContent('목표 목록을 불러오지 못했어요');
  });
});
