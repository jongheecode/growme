import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryEntry, getTaskHistory } from '../api/history';
import KkumiView from '../components/KkumiView';
import Icon from '../components/Icon';
import { colors, fonts, categoryMeta, difficultyLabel } from '../theme';

function formatFocus(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
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
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }} edges={['top']}>
        <Text testID="history-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
        <TouchableOpacity testID="history-retry" onPress={load}>
          <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!entries) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }} edges={['top']}>
        <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  if (entries.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }} edges={['top']}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <KkumiView species="SPECIES_B" stage={0} size={76} />
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Icon name="clock" color={colors.goldText} size={18} />
          </View>
        </View>
        <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink, marginBottom: 4 }}>아직 기록이 없어요</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: 'center' }}>
          미션을 완료하면 여기에 차곡차곡 쌓여요
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ padding: 18, paddingBottom: 6 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink }}>기록</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted }}>완료하고 실패한 미션들</Text>
      </View>
      <ScrollView testID="history-list" style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
        {entries.map((e) => {
          const cat = categoryMeta[e.category];
          const completed = e.status === 'COMPLETED';
          return (
            <View
              key={e.id}
              testID={`history-row-${e.id}`}
              style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink, flex: 1 }}>{e.title}</Text>
                <View
                  style={{
                    backgroundColor: completed ? '#EAF5EE' : colors.failTint,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ fontFamily: fonts.heading, fontSize: 11, color: completed ? colors.green : colors.fail }}>
                    {completed ? '완료' : '실패'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <View style={{ backgroundColor: `${cat.color}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 10, color: cat.color }}>{cat.label}</Text>
                </View>
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted }}>{difficultyLabel[e.difficulty]}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted }}>{`· ${formatDate(e.occurredAt)}`}</Text>
                {completed ? (
                  <Text style={{ fontFamily: fonts.heading, fontSize: 11, color: colors.goldText }}>{`+${e.xpValue}XP`}</Text>
                ) : null}
                {e.focusSeconds > 0 ? (
                  <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted }}>{formatFocus(e.focusSeconds)}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
