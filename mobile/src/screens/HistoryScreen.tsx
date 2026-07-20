import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { HistoryEntry, getTaskHistory } from '../api/history';

function formatFocus(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await getTaskHistory();
      setEntries(result);
    } catch {
      setError('히스토리를 불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="history-error">{error}</Text>
        <TouchableOpacity testID="history-retry" onPress={load}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!entries) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>불러오는 중...</Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>아직 기록이 없어요</Text>
      </View>
    );
  }

  return (
    <ScrollView testID="history-list" style={{ flex: 1 }}>
      {entries.map((e) => (
        <View key={e.id} testID={`history-row-${e.id}`} style={{ padding: 12 }}>
          <Text>{e.title}</Text>
          <Text>{`${e.category} · ${e.difficulty} · ${e.status === 'COMPLETED' ? '완료됨' : '실패'}`}</Text>
          {e.status === 'COMPLETED' ? <Text>{`+${e.xpValue}XP`}</Text> : null}
          {e.focusSeconds > 0 ? <Text>{formatFocus(e.focusSeconds)}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}
