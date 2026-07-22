import { useCallback, useEffect, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MyChallenge, createChallenge, joinChallenge, listMyChallenges } from '../api/challenges';
import { ProfileStackParamList } from '../navigation/ProfileStack';
import { colors, fonts } from '../theme';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Challenges'>;

const XP_PRESETS = [50, 100, 200, 500, 1000];

const inputStyle = {
  padding: 13,
  borderWidth: 1.5,
  borderColor: colors.border,
  borderRadius: 14,
  backgroundColor: colors.card,
  fontFamily: fonts.body,
  fontSize: 14,
  color: colors.ink,
};

export default function ChallengesScreen() {
  const navigation = useNavigation<Nav>();
  const [challenges, setChallenges] = useState<MyChallenge[]>([]);
  const [name, setName] = useState('');
  const [targetXp, setTargetXp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [xpPickerOpen, setXpPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await listMyChallenges();
      setChallenges(result);
    } catch {
      setError('챌린지 목록을 불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    const parsedTargetXp = Number(targetXp);
    if (name.trim().length === 0 || !Number.isFinite(parsedTargetXp)) return;
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await createChallenge(name.trim(), parsedTargetXp, startDate, endDate);
      setName('');
      setTargetXp('');
      await load();
    } catch {
      setError('챌린지를 만들지 못했어요');
    }
  }

  async function handleJoin() {
    if (inviteCode.trim().length === 0) return;
    try {
      await joinChallenge(inviteCode.trim());
      setInviteCode('');
      await load();
    } catch {
      setError('챌린지에 참여하지 못했어요');
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: 14 }}>챌린지</Text>

      {error ? (
        <Text testID="challenges-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
      ) : null}

      <View style={{ gap: 10, marginBottom: 20 }}>
        {challenges.map((c) => {
          const pct = Math.min(100, Math.round(c.percent));
          return (
            <TouchableOpacity
              key={c.id}
              testID={`challenge-row-${c.id}`}
              onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
              style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15 }}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink, marginBottom: 8 }}>
                {`${c.name} — ${pct}% (${c.achievedXp}/${c.targetXp}XP)`}
              </Text>
              <View style={{ height: 10, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.green }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginBottom: 8 }}>새 챌린지 만들기</Text>
      <View style={{ gap: 10, marginBottom: 20 }}>
        <TextInput testID="challenge-name-input" placeholder="챌린지 이름" placeholderTextColor={colors.inkFaint} value={name} onChangeText={setName} style={inputStyle} />
        <TouchableOpacity testID="challenge-target-xp-trigger" onPress={() => setXpPickerOpen(true)} style={inputStyle}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: targetXp ? colors.ink : colors.inkFaint }}>
            {targetXp ? `목표 ${targetXp} XP` : '목표 XP 선택'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity testID="create-challenge-submit" onPress={handleCreate} style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>챌린지 만들기</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={xpPickerOpen} transparent animationType="slide" onRequestClose={() => setXpPickerOpen(false)}>
        <View testID="xp-picker-modal" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,38,34,.4)' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 36 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginBottom: 16 }}>목표 XP 선택</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {XP_PRESETS.map((xp) => (
                <TouchableOpacity
                  key={xp}
                  testID={`xp-chip-${xp}`}
                  onPress={() => {
                    setTargetXp(String(xp));
                    setXpPickerOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: targetXp === String(xp) ? colors.green : colors.card,
                    borderWidth: targetXp === String(xp) ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: targetXp === String(xp) ? '#fff' : colors.ink }}>
                    {`${xp} XP`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              testID="xp-picker-close"
              onPress={() => setXpPickerOpen(false)}
              style={{ paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 15 }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginBottom: 8 }}>초대코드로 참여</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          testID="invite-code-input"
          placeholder="초대코드 입력"
          placeholderTextColor={colors.inkFaint}
          value={inviteCode}
          onChangeText={setInviteCode}
          style={[inputStyle, { flex: 1 }]}
        />
        <TouchableOpacity testID="join-challenge-submit" onPress={handleJoin} style={{ paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 14 }}>참여</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
