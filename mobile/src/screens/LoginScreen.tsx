import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigation = useNavigation<Nav>();

  async function handleSubmit() {
    setError('');
    try {
      const token = await loginApi(email, password);
      await login(token);
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않아요');
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>그로우미</Text>
      <TextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        testID="login-email"
      />
      <TextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />
      <Button title="로그인" onPress={handleSubmit} testID="login-submit" />
      {error ? <Text testID="login-error">{error}</Text> : null}
      <Button title="회원가입" onPress={() => navigation.navigate('Signup')} />
    </View>
  );
}
