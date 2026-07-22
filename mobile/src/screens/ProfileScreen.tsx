import { useEffect, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalsContext';
import { getMe, Me } from '../api/users';
import { isReminderEnabled, setReminderEnabled } from '../notifications';
import { ProfileStackParamList } from '../navigation/ProfileStack';
import Icon, { IconName } from '../components/Icon';
import { colors, fonts } from '../theme';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

const MENU: { testID: string; label: string; icon: IconName; color: string; navigate: keyof ProfileStackParamList }[] = [
  { testID: 'nav-friends', label: '친구', icon: 'friends', color: '#EE9E86', navigate: 'Friends' },
  { testID: 'nav-leaderboard', label: '랭킹', icon: 'ranking', color: '#B58A2E', navigate: 'Leaderboard' },
  { testID: 'nav-challenges', label: '챌린지', icon: 'challenge', color: '#9179CC', navigate: 'Challenges' },
];

function formatJoinDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')} 가입`;
}

export default function ProfileScreen() {
  const { logout } = useAuth();
  const { startAddGoal, goals } = useGoals();
  const navigation = useNavigation<Nav>();
  const [me, setMe] = useState<Me | null>(null);
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderError, setReminderError] = useState('');

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => {});
    isReminderEnabled().then(setReminderOn);
  }, []);

  async function handleToggleReminder(next: boolean) {
    setReminderError('');
    const ok = await setReminderEnabled(next);
    if (!ok) {
      setReminderError('알림 권한이 필요해요. 기기 설정에서 허용해주세요.');
      return;
    }
    setReminderOn(next);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 18 }} edges={['top']}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: 16 }}>프로필</Text>
      <View
        testID="profile-stats-card"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <View>
          <Text testID="profile-nickname" style={{ fontFamily: fonts.heading, fontSize: 18, color: colors.ink }}>
            {me?.nickname ?? '...'}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>
            {me ? formatJoinDate(me.createdAt) : ' '}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text testID="profile-goal-count" style={{ fontFamily: fonts.heading, fontSize: 20, color: colors.green }}>
            {goals.length}
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted }}>목표</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {MENU.map((m) => (
          <TouchableOpacity
            key={m.testID}
            testID={m.testID}
            onPress={() => navigation.navigate(m.navigate as never)}
            style={{
              width: '48%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 18,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: `${m.color}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={m.icon} color={m.color} size={22} active />
            </View>
            <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View
        testID="reminder-row"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: 14,
          marginTop: 14,
        }}
      >
        <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.ink }}>오늘 미션 리마인더</Text>
        <Switch testID="reminder-toggle" value={reminderOn} onValueChange={handleToggleReminder} />
      </View>
      {reminderError ? (
        <Text testID="reminder-error" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.fail, marginTop: 6 }}>
          {reminderError}
        </Text>
      ) : null}
      <TouchableOpacity
        testID="nav-account-settings"
        onPress={() => navigation.navigate('AccountSettings')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: 14,
          marginTop: 10,
        }}
      >
        <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.ink }}>계정 설정</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 16 }}>›</Text>
      </TouchableOpacity>
      <View style={{ marginTop: 18, gap: 10 }}>
        <TouchableOpacity
          testID="add-goal-button"
          onPress={() => startAddGoal()}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>+ 새 목표 추가</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="logout-button"
          onPress={() => logout()}
          style={{
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 16,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 15 }}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
