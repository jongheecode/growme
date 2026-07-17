import { View, Text, Button } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { startAddGoal } = useGoals();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
      <Button title="새 목표 추가" onPress={() => startAddGoal()} testID="add-goal-button" />
      <Button title="로그아웃" onPress={() => logout()} testID="logout-button" />
    </View>
  );
}
