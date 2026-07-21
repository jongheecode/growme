import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { ChallengeDetail, getChallenge, leaveChallenge } from '../api/challenges';
import { Me, getMe } from '../api/users';
import { ProfileStackParamList } from '../navigation/ProfileStack';
import { colors, fonts } from '../theme';

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text testID="challenge-detail-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
        <TouchableOpacity testID="challenge-detail-retry" onPress={load}>
          <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!detail || !me) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>불러오는 중...</Text>
      </View>
    );
  }

  const isCreator = detail.createdById === me.id;
  const overallPct = Math.min(100, Math.round((detail.members.reduce((sum, m) => sum + m.achievedXp, 0) / (detail.targetXp || 1)) * 100));
  const topXp = Math.max(1, ...detail.members.map((m) => m.achievedXp));
  const sortedMembers = [...detail.members].sort((a, b) => b.achievedXp - a.achievedXp);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginBottom: 14 }}>{detail.name}</Text>

      <View style={{ backgroundColor: '#EFE8F7', borderRadius: 20, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted }}>전체 진행률</Text>
          <Text style={{ fontFamily: fonts.heading, fontSize: 17, color: '#7A63B8' }}>{`${overallPct}%`}</Text>
        </View>
        <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,.6)', borderRadius: 6, overflow: 'hidden', marginTop: 8, marginBottom: 6 }}>
          <View style={{ width: `${overallPct}%`, height: '100%', backgroundColor: colors.lavender }} />
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted }}>{`목표 ${detail.targetXp}XP`}</Text>
      </View>

      <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.inkMuted, marginBottom: 8 }}>멤버 진행률</Text>
      <View style={{ gap: 8, marginBottom: 18 }}>
        {sortedMembers.map((m, i) => (
          <View
            key={m.userId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 11 }}
          >
            <Text style={{ width: 22, fontFamily: fonts.heading, fontSize: 14, color: colors.goldText, textAlign: 'center' }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.ink }}>
                {`${m.nickname} — ${Math.round(m.percent)}% (${m.achievedXp}/${detail.targetXp}XP)`}
              </Text>
              <View style={{ height: 7, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden', marginTop: 5 }}>
                <View style={{ width: `${Math.round((m.achievedXp / topXp) * 100)}%`, height: '100%', backgroundColor: colors.lavender }} />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: '#F5EFE4', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginBottom: 8 }}>친구를 초대해요</Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 18,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontFamily: fonts.heading, fontSize: 18, letterSpacing: 2, color: colors.ink }}>{`초대코드: ${detail.inviteCode}`}</Text>
        </View>
      </View>

      {!isCreator ? (
        <TouchableOpacity
          testID="leave-challenge-button"
          onPress={handleLeave}
          style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 14 }}>나가기</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
