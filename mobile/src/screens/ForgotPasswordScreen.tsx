import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { forgotPassword, resetPassword } from '../api/auth';
import { AuthStackParamList } from '../navigation/AuthStack';
import { useErrorMessage } from '../hooks/useErrorMessage';
import { colors, fonts } from '../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

const fieldStyle = {
  width: '100%' as const,
  padding: 15,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: 16,
  backgroundColor: colors.card,
  fontFamily: fonts.body,
  fontSize: 15,
  color: colors.ink,
};

export default function ForgotPasswordScreen() {
  const resolveError = useErrorMessage();
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [requested, setRequested] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleRequest() {
    setError('');
    try {
      await forgotPassword(email.trim());
      setMessage('해당 이메일 계정이 있다면 재설정 링크를 보냈어요');
      setRequested(true);
    } catch {
      setError(resolveError('요청을 처리하지 못했어요'));
    }
  }

  async function handleReset() {
    setError('');
    try {
      await resetPassword(token.trim(), newPassword);
      setDone(true);
    } catch {
      setError(resolveError('토큰이 올바르지 않거나 만료됐어요'));
    }
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text testID="reset-done" style={{ fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginBottom: 20 }}>
          비밀번호가 변경됐어요
        </Text>
        <TouchableOpacity
          testID="reset-back-to-login"
          onPress={() => navigation.navigate('Login')}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 32 }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>로그인하러 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: 20 }}>비밀번호 재설정</Text>

        <View style={{ gap: 12, marginBottom: 16 }}>
          <TextInput
            testID="forgot-email"
            placeholder="이메일"
            placeholderTextColor={colors.inkFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            style={fieldStyle}
          />
        </View>
        <TouchableOpacity
          testID="forgot-submit"
          onPress={handleRequest}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 20 }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>재설정 링크 요청</Text>
        </TouchableOpacity>

        {message ? (
          <Text testID="forgot-message" style={{ fontFamily: fonts.body, color: colors.inkMuted, textAlign: 'center', marginBottom: 20 }}>
            {message}
          </Text>
        ) : null}

        {requested ? (
          <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink }}>받은 토큰으로 새 비밀번호 설정</Text>
            <TextInput
              testID="reset-token"
              placeholder="재설정 토큰"
              placeholderTextColor={colors.inkFaint}
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              style={fieldStyle}
            />
            <TextInput
              testID="reset-new-password"
              placeholder="새 비밀번호"
              placeholderTextColor={colors.inkFaint}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={fieldStyle}
            />
            <TouchableOpacity
              testID="reset-submit"
              onPress={handleReset}
              style={{ backgroundColor: colors.ink, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>비밀번호 재설정</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <Text testID="forgot-error" style={{ fontFamily: fonts.body, color: colors.fail, textAlign: 'center', marginTop: 16 }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity testID="forgot-back-to-login" onPress={() => navigation.navigate('Login')} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 }}>로그인으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
