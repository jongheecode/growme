import { View, Text, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';
import { ProfileStackParamList } from '../navigation/ProfileStack';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { startAddGoal } = useGoals();
  const navigation = useNavigation<Nav>();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
      <Button title="새 목표 추가" onPress={() => startAddGoal()} testID="add-goal-button" />
      <Button title="친구" onPress={() => navigation.navigate('Friends')} testID="nav-friends" />
      <Button title="랭킹" onPress={() => navigation.navigate('Leaderboard')} testID="nav-leaderboard" />
      <Button title="챌린지" onPress={() => navigation.navigate('Challenges')} testID="nav-challenges" />
      <Button title="상점" onPress={() => navigation.navigate('Shop')} testID="nav-shop" />
      <Button title="로그아웃" onPress={() => logout()} testID="logout-button" />
    </View>
  );
}
