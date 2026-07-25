import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertButton, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LeaderboardEntry, LeaderboardRange, LeaderboardScope, getLeaderboard } from '../api/leaderboard';
import { getMe } from '../api/users';
import { blockUser, reportUser } from '../api/safety';
import { useErrorMessage } from '../hooks/useErrorMessage';
import { colors, fonts } from '../theme';

const REPORT_REASONS = ['스팸', '부적절한 콘텐츠', '괴롭힘', '기타'];

function toggleStyle(active: boolean) {
  return {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center' as const,
    backgroundColor: active ? colors.ink : colors.border,
  };
}

export default function LeaderboardScreen() {
  const resolveError = useErrorMessage();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [range, setRange] = useState<LeaderboardRange>('alltime');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const load = useCallback(async (s: LeaderboardScope, r: LeaderboardRange) => {
    try {
      setError('');
      const result = await getLeaderboard(s, r);
      setEntries(result);
    } catch {
      setError(resolveError('랭킹을 불러오지 못했어요'));
    }
  }, [resolveError]);

  useEffect(() => {
    load(scope, range);
  }, [scope, range, load]);

  useEffect(() => {
    getMe()
      .then((me) => setMyUserId(me.id))
      .catch(() => {});
  }, []);

  async function handleBlock(entry: LeaderboardEntry) {
    try {
      await blockUser(entry.userId);
      await load(scope, range);
    } catch {
      setError(resolveError('차단하지 못했어요'));
    }
  }

  async function handleReport(entry: LeaderboardEntry, reason: string) {
    try {
      await reportUser(entry.userId, reason);
    } catch {
      setError(resolveError('신고를 접수하지 못했어요'));
    }
  }

  function openReportReasons(entry: LeaderboardEntry) {
    Alert.alert(
      '신고 사유 선택',
      undefined,
      [
        ...REPORT_REASONS.map((reason): AlertButton => ({ text: reason, onPress: () => handleReport(entry, reason) })),
        { text: '취소', style: 'cancel' },
      ]
    );
  }

  function openEntryActions(entry: LeaderboardEntry) {
    Alert.alert(entry.nickname, undefined, [
      { text: '신고', onPress: () => openReportReasons(entry) },
      { text: '차단', style: 'destructive', onPress: () => handleBlock(entry) },
      { text: '취소', style: 'cancel' },
    ]);
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text testID="leaderboard-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
        <TouchableOpacity testID="leaderboard-retry" onPress={() => load(scope, range)}>
          <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 18 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: 12 }}>랭킹</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TouchableOpacity testID="scope-friends" onPress={() => setScope('friends')} style={toggleStyle(scope === 'friends')}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: scope === 'friends' ? '#fff' : colors.inkMuted }}>친구</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="scope-global" onPress={() => setScope('global')} style={toggleStyle(scope === 'global')}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: scope === 'global' ? '#fff' : colors.inkMuted }}>전체</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <TouchableOpacity testID="range-weekly" onPress={() => setRange('weekly')} style={toggleStyle(range === 'weekly')}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: range === 'weekly' ? '#fff' : colors.inkMuted }}>주간</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="range-alltime" onPress={() => setRange('alltime')} style={toggleStyle(range === 'alltime')}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: range === 'alltime' ? '#fff' : colors.inkMuted }}>전체기간</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        {entries.map((e) => (
          <View
            key={e.userId}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12 }}
          >
            <Text style={{ width: 26, fontFamily: fonts.heading, fontSize: 16, color: colors.goldText, textAlign: 'center' }}>{e.rank}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.heading, fontSize: 15, color: colors.ink }}>{`${e.nickname} — ${e.totalXp}XP`}</Text>
            {e.userId !== myUserId ? (
              <TouchableOpacity testID={`leaderboard-actions-${e.userId}`} onPress={() => openEntryActions(e)} style={{ padding: 6 }}>
                <Text style={{ color: colors.inkFaint, fontSize: 18 }}>⋯</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
