import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ChallengeDetail, getChallenge, leaveChallenge } from '../api/challenges';
import { Me, getMe } from '../api/users';
import { ProfileStackParamList } from '../navigation/ProfileStack';

type Route = RouteProp<ProfileStackParamList, 'ChallengeDetail'>;

export default function ChallengeDetailScreen() {
  const route = useRoute<Route>();
  const { challengeId } = route.params;
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [detailResult, meResult] = await Promise.all([getChallenge(challengeId), getMe()]);
      setDetail(detailResult);
      setMe(meResult);
    } catch {
      setError('챌린지 정보를 불러오지 못했어요');
    }
  }, [challengeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLeave() {
    try {
      await leaveChallenge(challengeId);
    } catch {
      setError('챌린지에서 나가지 못했어요');
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="challenge-detail-error">{error}</Text>
        <TouchableOpacity testID="challenge-detail-retry" onPress={load}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!detail || !me) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>불러오는 중...</Text>
      </View>
    );
  }

  const isCreator = detail.createdById === me.id;

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text>{detail.name}</Text>
      <Text>{`초대코드: ${detail.inviteCode}`}</Text>
      {detail.members.map((m) => (
        <View key={m.userId}>
          <Text>{`${m.nickname} — ${Math.round(m.percent)}% (${m.achievedXp}/${detail.targetXp}XP)`}</Text>
        </View>
      ))}
      {!isCreator ? (
        <TouchableOpacity testID="leave-challenge-button" onPress={handleLeave}>
          <Text>나가기</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
