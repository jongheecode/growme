import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login as loginApi, loginWithGoogle, loginWithKakao } from '../api/auth';
import { requestGoogleIdToken, requestKakaoAccessToken } from '../oauth';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/AuthStack';
import KkumiView from '../components/KkumiView';
import { colors, fonts } from '../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// client ID가 아직 설정 안 된 provider는 눌러도 절대 동작할 수 없으므로
// 버튼 자체를 숨긴다 — "눌리는데 안 되는 버튼"이 없는 것보다 나쁘다.
const extra = (Constants.expoConfig?.extra ?? {}) as { googleClientId?: string; kakaoClientId?: string };
const GOOGLE_ENABLED = !!extra.googleClientId;
const KAKAO_ENABLED = !!extra.kakaoClientId;

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

  async function handleGoogleLogin() {
    setError('');
    try {
      const idToken = await requestGoogleIdToken();
      const token = await loginWithGoogle(idToken);
      await login(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '구글 로그인에 실패했어요');
    }
  }

  async function handleKakaoLogin() {
    setError('');
    try {
      const accessToken = await requestKakaoAccessToken();
      const token = await loginWithKakao(accessToken);
      await login(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '카카오 로그인에 실패했어요');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: 220,
          backgroundColor: '#FBEAD6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <KkumiView species={null} stage={0} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 30 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink, textAlign: 'center' }}>
          다시 만나서 반가워요
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
          오늘도 꾸미가 기다리고 있어요
        </Text>

        <View style={{ gap: 12, marginBottom: 18 }}>
          <TextInput
            placeholder="이메일"
            placeholderTextColor={colors.inkFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            testID="login-email"
            style={fieldStyle}
          />
          <TextInput
            placeholder="비밀번호"
            placeholderTextColor={colors.inkFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="login-password"
            style={fieldStyle}
          />
        </View>

        {error ? (
          <Text testID="login-error" style={{ fontFamily: fonts.body, color: colors.fail, textAlign: 'center', marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="login-submit"
          onPress={handleSubmit}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 17 }}>로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="login-forgot-password" onPress={() => navigation.navigate('ForgotPassword')} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 }}>비밀번호를 잊으셨나요?</Text>
        </TouchableOpacity>

        {GOOGLE_ENABLED || KAKAO_ENABLED ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkFaint, marginHorizontal: 10 }}>또는</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <View style={{ gap: 10 }}>
              {GOOGLE_ENABLED ? (
                <TouchableOpacity
                  testID="login-google"
                  onPress={handleGoogleLogin}
                  style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.card }}
                >
                  <Text style={{ fontFamily: fonts.heading, color: colors.ink, fontSize: 14 }}>구글로 계속하기</Text>
                </TouchableOpacity>
              ) : null}
              {KAKAO_ENABLED ? (
                <TouchableOpacity
                  testID="login-kakao"
                  onPress={handleKakaoLogin}
                  style={{ borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FEE500' }}
                >
                  <Text style={{ fontFamily: fonts.heading, color: '#3C1E1E', fontSize: 14 }}>카카오로 계속하기</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted }}>아직 계정이 없나요? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={{ fontFamily: fonts.heading, color: colors.green, fontSize: 14 }}>회원가입</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
