import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../context/AuthContext';
import ProfileScreen from './ProfileScreen';

const mockStartAddGoal = jest.fn();

jest.mock('../context/GoalsContext', () => ({
  useGoals: () => ({ startAddGoal: mockStartAddGoal }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function DummyScreen({ route }: { route: { name: string } }) {
  return (
    <View>
      <Text testID="dummy-screen-name">{route.name}</Text>
    </View>
  );
}

function renderProfile() {
  const Stack = createNativeStackNavigator();
  return render(
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="ProfileHome" component={ProfileScreen} />
          <Stack.Screen name="Friends" component={DummyScreen} />
          <Stack.Screen name="Leaderboard" component={DummyScreen} />
          <Stack.Screen name="Challenges" component={DummyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

describe('ProfileScreen', () => {
  it('logs out when the button is pressed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored-token');
    renderProfile();
    await waitFor(() => expect(screen.getByTestId('logout-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('logout-button'));
    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('growme_token'));
  });

  it('starts adding a goal when the button is pressed', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByTestId('add-goal-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('add-goal-button'));
    expect(mockStartAddGoal).toHaveBeenCalled();
  });

  it('navigates to the friends screen', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByTestId('nav-friends')).toBeTruthy());
    fireEvent.press(screen.getByTestId('nav-friends'));
    await waitFor(() => expect(screen.getByTestId('dummy-screen-name')).toHaveTextContent('Friends'));
  });

  it('navigates to the leaderboard screen', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByTestId('nav-leaderboard')).toBeTruthy());
    fireEvent.press(screen.getByTestId('nav-leaderboard'));
    await waitFor(() => expect(screen.getByTestId('dummy-screen-name')).toHaveTextContent('Leaderboard'));
  });

  it('navigates to the challenges screen', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByTestId('nav-challenges')).toBeTruthy());
    fireEvent.press(screen.getByTestId('nav-challenges'));
    await waitFor(() => expect(screen.getByTestId('dummy-screen-name')).toHaveTextContent('Challenges'));
  });
});
