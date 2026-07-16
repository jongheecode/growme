import { View, Text, Button } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>프로필 화면 준비 중입니다</Text>
      <Button title="로그아웃" onPress={() => logout()} testID="logout-button" />
    </View>
  );
}
