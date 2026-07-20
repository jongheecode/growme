import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as challengesApi from '../api/challenges';
import * as usersApi from '../api/users';
import ChallengeDetailScreen from './ChallengeDetailScreen';

jest.mock('../api/challenges');
jest.mock('../api/users');

const detailAsCreator: challengesApi.ChallengeDetail = {
  id: 'c1',
  name: '집중 챌린지',
  category: null,
  targetXp: 100,
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-07-08T00:00:00.000Z',
  inviteCode: 'abcd1234',
  createdById: 'me',
  members: [
    { userId: 'other', nickname: '영희', achievedXp: 90, percent: 90 },
    { userId: 'me', nickname: '나', achievedXp: 40, percent: 40 },
  ],
};

function renderDetail(challengeId = 'c1') {
  const Stack = createNativeStackNavigator();
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="ChallengeDetail"
          component={ChallengeDetailScreen}
          initialParams={{ challengeId }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (challengesApi.getChallenge as jest.Mock).mockResolvedValue(detailAsCreator);
  (challengesApi.leaveChallenge as jest.Mock).mockResolvedValue(undefined);
  (usersApi.getMe as jest.Mock).mockResolvedValue({
    id: 'me',
    email: 'me@example.com',
    nickname: '나',
    bio: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
});

describe('ChallengeDetailScreen', () => {
  it('loads and shows members ranked by progress, and the invite code', async () => {
    renderDetail();
    await waitFor(() => expect(challengesApi.getChallenge).toHaveBeenCalledWith('c1'));
    expect(screen.getByText(/영희/)).toBeTruthy();
    expect(screen.getByText(/abcd1234/)).toBeTruthy();
  });

  it('hides the leave button for the creator', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText(/영희/)).toBeTruthy());
    expect(screen.queryByTestId('leave-challenge-button')).toBeNull();
  });

  it('shows a leave button for a non-creator member and calls leaveChallenge on press', async () => {
    (challengesApi.getChallenge as jest.Mock).mockResolvedValue({
      ...detailAsCreator,
      createdById: 'someone-else',
    });
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('leave-challenge-button')).toBeTruthy());

    fireEvent.press(screen.getByTestId('leave-challenge-button'));
    await waitFor(() => expect(challengesApi.leaveChallenge).toHaveBeenCalledWith('c1'));
  });
});
