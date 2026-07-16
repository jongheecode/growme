import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { signup as signupApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  async function handleSubmit() {
    setError('');
    try {
      const token = await signupApi(email, password, nickname);
      await login(token);
    } catch {
      setError('회원가입에 실패했어요');
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>회원가입</Text>
      <TextInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        testID="signup-email"
      />
      <TextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="signup-password"
      />
      <TextInput
        placeholder="닉네임"
        value={nickname}
        onChangeText={setNickname}
        testID="signup-nickname"
      />
      <Button title="가입하기" onPress={handleSubmit} testID="signup-submit" />
      {error ? <Text testID="signup-error">{error}</Text> : null}
    </View>
  );
}
