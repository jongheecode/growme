import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

function LoginPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>로그인 화면 준비 중입니다</Text>
    </View>
  );
}

function SignupPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>회원가입 화면 준비 중입니다</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginPlaceholder} />
      <Stack.Screen name="Signup" component={SignupPlaceholder} />
    </Stack.Navigator>
  );
}
