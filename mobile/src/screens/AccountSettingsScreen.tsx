import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { changePassword } from '../api/auth';
import { getMe, updateEmail, deleteAccount } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

const fieldStyle = {
  padding: 13,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: 14,
  backgroundColor: colors.card,
  fontFamily: fonts.body,
  fontSize: 14,
  color: colors.ink,
};

export default function AccountSettingsScreen() {
  const { logout } = useAuth();
  const [email, setEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    getMe()
      .then((me) => setEmail(me.email ?? ''))
      .catch(() => {});
  }, []);

  async function handleUpdateEmail() {
    setEmailMessage('');
    setEmailError('');
    try {
      await updateEmail(email.trim());
      setEmailMessage('이메일이 변경됐어요');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '이메일을 변경하지 못했어요');
    }
  }

  async function handleChangePassword() {
    setPasswordMessage('');
    setPasswordError('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('비밀번호가 변경됐어요');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPasswordError('현재 비밀번호를 확인해주세요');
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    try {
      await deleteAccount();
      await logout();
    } catch {
      setDeleteError('회원 탈퇴에 실패했어요');
    }
  }

  function confirmDelete() {
    Alert.alert('회원 탈퇴', '정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: handleDeleteAccount },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: 20 }}>계정 설정</Text>

      <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginBottom: 8 }}>이메일 변경</Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        <TextInput
          testID="settings-email-input"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="이메일"
          placeholderTextColor={colors.inkFaint}
          style={fieldStyle}
        />
        {emailMessage ? (
          <Text testID="settings-email-message" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.green }}>
            {emailMessage}
          </Text>
        ) : null}
        {emailError ? (
          <Text testID="settings-email-error" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.fail }}>
            {emailError}
          </Text>
        ) : null}
        <TouchableOpacity
          testID="settings-email-submit"
          onPress={handleUpdateEmail}
          style={{ backgroundColor: colors.green, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 14 }}>이메일 저장</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginBottom: 8 }}>비밀번호 변경</Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        <TextInput
          testID="settings-current-password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          placeholder="현재 비밀번호"
          placeholderTextColor={colors.inkFaint}
          style={fieldStyle}
        />
        <TextInput
          testID="settings-new-password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="새 비밀번호"
          placeholderTextColor={colors.inkFaint}
          style={fieldStyle}
        />
        {passwordMessage ? (
          <Text testID="settings-password-message" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.green }}>
            {passwordMessage}
          </Text>
        ) : null}
        {passwordError ? (
          <Text testID="settings-password-error" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.fail }}>
            {passwordError}
          </Text>
        ) : null}
        <TouchableOpacity
          testID="settings-password-submit"
          onPress={handleChangePassword}
          style={{ backgroundColor: colors.green, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 14 }}>비밀번호 저장</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.fail, marginBottom: 8 }}>계정 탈퇴</Text>
      <View style={{ gap: 10 }}>
        {deleteError ? (
          <Text testID="settings-delete-error" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.fail }}>
            {deleteError}
          </Text>
        ) : null}
        <TouchableOpacity
          testID="settings-delete-account"
          onPress={confirmDelete}
          style={{ borderWidth: 1.5, borderColor: colors.fail, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: colors.fail, fontSize: 14 }}>회원 탈퇴</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
