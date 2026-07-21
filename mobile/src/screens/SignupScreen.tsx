import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signup as signupApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/AuthStack';
import KkumiView from '../components/KkumiView';
import { colors, fonts } from '../theme';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

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

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigation = useNavigation<Nav>();

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
          꾸미와 시작하기
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
          알을 부화시킬 준비가 됐나요?
        </Text>

        <View style={{ gap: 12, marginBottom: 18 }}>
          <TextInput
            placeholder="닉네임"
            placeholderTextColor={colors.inkFaint}
            value={nickname}
            onChangeText={setNickname}
            testID="signup-nickname"
            style={fieldStyle}
          />
          <TextInput
            placeholder="이메일"
            placeholderTextColor={colors.inkFaint}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            testID="signup-email"
            style={fieldStyle}
          />
          <TextInput
            placeholder="비밀번호"
            placeholderTextColor={colors.inkFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            testID="signup-password"
            style={fieldStyle}
          />
        </View>

        {error ? (
          <Text testID="signup-error" style={{ fontFamily: fonts.body, color: colors.fail, textAlign: 'center', marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          testID="signup-submit"
          onPress={handleSubmit}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 17 }}>회원가입</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted }}>이미 계정이 있나요? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={{ fontFamily: fonts.heading, color: colors.green, fontSize: 14 }}>로그인</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
