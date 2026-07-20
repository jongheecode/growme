import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import FriendsScreen from '../screens/FriendsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Friends: undefined;
  Leaderboard: undefined;
  Challenges: undefined;
  ChallengeDetail: { challengeId: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: '프로필' }} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: '친구' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: '랭킹' }} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} options={{ title: '챌린지' }} />
      <Stack.Screen
        name="ChallengeDetail"
        component={ChallengeDetailScreen}
        options={{ title: '챌린지 상세' }}
      />
    </Stack.Navigator>
  );
}
