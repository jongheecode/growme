import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import * as challengesApi from '../api/challenges';
import ChallengesScreen from './ChallengesScreen';

jest.mock('../api/challenges');

const myChallenges: challengesApi.MyChallenge[] = [
  {
    id: 'c1',
    name: '집중 챌린지',
    category: null,
    targetXp: 100,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-08T00:00:00.000Z',
    inviteCode: 'abcd1234',
    createdById: 'u1',
    achievedXp: 40,
    percent: 40,
  },
];

function DummyDetailScreen(props: any) {
  return (
    <View>
      <Text testID="dummy-challenge-id">{props.route.params.challengeId}</Text>
    </View>
  );
}

function renderChallenges() {
  const Stack = createNativeStackNavigator();
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Challenges" component={ChallengesScreen} />
        <Stack.Screen name="ChallengeDetail" component={DummyDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (challengesApi.listMyChallenges as jest.Mock).mockResolvedValue([]);
  (challengesApi.createChallenge as jest.Mock).mockResolvedValue({ id: 'new-challenge' });
  (challengesApi.joinChallenge as jest.Mock).mockResolvedValue({ id: 'joined-challenge' });
});

describe('ChallengesScreen', () => {
  it('loads and shows my challenges with progress', async () => {
    (challengesApi.listMyChallenges as jest.Mock).mockResolvedValue(myChallenges);
    renderChallenges();
    await waitFor(() => expect(screen.getByText(/집중 챌린지/)).toBeTruthy());
    expect(challengesApi.listMyChallenges).toHaveBeenCalled();
  });

  it('creates a challenge from the form', async () => {
    renderChallenges();
    await waitFor(() => expect(screen.getByTestId('challenge-name-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('challenge-name-input'), '새 챌린지');
    fireEvent.changeText(screen.getByTestId('challenge-target-xp-input'), '200');
    fireEvent.press(screen.getByTestId('create-challenge-submit'));

    await waitFor(() => expect(challengesApi.createChallenge).toHaveBeenCalled());
  });

  it('joins a challenge by invite code', async () => {
    renderChallenges();
    await waitFor(() => expect(screen.getByTestId('invite-code-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('invite-code-input'), 'abcd1234');
    fireEvent.press(screen.getByTestId('join-challenge-submit'));

    await waitFor(() => expect(challengesApi.joinChallenge).toHaveBeenCalledWith('abcd1234'));
  });

  it('navigates to the challenge detail when a row is tapped', async () => {
    (challengesApi.listMyChallenges as jest.Mock).mockResolvedValue(myChallenges);
    renderChallenges();
    await waitFor(() => expect(screen.getByTestId('challenge-row-c1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('challenge-row-c1'));
    await waitFor(() => expect(screen.getByTestId('dummy-challenge-id')).toHaveTextContent('c1'));
  });
});
