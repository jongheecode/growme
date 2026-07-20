import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { LeaderboardEntry, LeaderboardRange, LeaderboardScope, getLeaderboard } from '../api/leaderboard';

export default function LeaderboardScreen() {
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [range, setRange] = useState<LeaderboardRange>('alltime');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (s: LeaderboardScope, r: LeaderboardRange) => {
    try {
      setError('');
      const result = await getLeaderboard(s, r);
      setEntries(result);
    } catch {
      setError('랭킹을 불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    load(scope, range);
  }, [scope, range, load]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="leaderboard-error">{error}</Text>
        <TouchableOpacity testID="leaderboard-retry" onPress={() => load(scope, range)}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity testID="scope-friends" onPress={() => setScope('friends')}>
          <Text>{`친구${scope === 'friends' ? ' ✓' : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="scope-global" onPress={() => setScope('global')}>
          <Text>{`전체${scope === 'global' ? ' ✓' : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="range-weekly" onPress={() => setRange('weekly')}>
          <Text>{`주간${range === 'weekly' ? ' ✓' : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="range-alltime" onPress={() => setRange('alltime')}>
          <Text>{`전체기간${range === 'alltime' ? ' ✓' : ''}`}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView>
        {entries.map((e) => (
          <View key={e.userId}>
            <Text>{`${e.rank}. ${e.nickname} — ${e.totalXp}XP`}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
