import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MyChallenge, createChallenge, joinChallenge, listMyChallenges } from '../api/challenges';
import { ProfileStackParamList } from '../navigation/ProfileStack';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Challenges'>;

export default function ChallengesScreen() {
  const navigation = useNavigation<Nav>();
  const [challenges, setChallenges] = useState<MyChallenge[]>([]);
  const [name, setName] = useState('');
  const [targetXp, setTargetXp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

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
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {error ? <Text testID="challenges-error">{error}</Text> : null}

      {challenges.map((c) => (
        <TouchableOpacity
          key={c.id}
          testID={`challenge-row-${c.id}`}
          onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
        >
          <Text>{`${c.name} — ${Math.round(c.percent)}% (${c.achievedXp}/${c.targetXp}XP)`}</Text>
        </TouchableOpacity>
      ))}

      <TextInput testID="challenge-name-input" placeholder="챌린지 이름" value={name} onChangeText={setName} />
      <TextInput
        testID="challenge-target-xp-input"
        placeholder="목표 XP"
        value={targetXp}
        onChangeText={setTargetXp}
        keyboardType="numeric"
      />
      <TouchableOpacity testID="create-challenge-submit" onPress={handleCreate}>
        <Text>챌린지 만들기</Text>
      </TouchableOpacity>

      <TextInput
        testID="invite-code-input"
        placeholder="초대코드로 참여"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <TouchableOpacity testID="join-challenge-submit" onPress={handleJoin}>
        <Text>참여하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
