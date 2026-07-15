import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';
import Layout from '../components/Layout';
import { CATEGORY_TINT } from '../components/KkumiCharacter';
import { DumbbellIcon } from '../components/icons/DumbbellIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { OpenBookIcon } from '../components/icons/OpenBookIcon';
import { StarIcon } from '../components/icons/StarIcon';

const CATEGORY_LABEL: Record<string, string> = {
  EXERCISE: '운동',
  STUDY: '학업',
  READING: '독서',
  ETC: '기타',
};
const CATEGORY_ICON: Record<string, typeof DumbbellIcon> = {
  EXERCISE: DumbbellIcon,
  STUDY: PencilIcon,
  READING: OpenBookIcon,
  ETC: StarIcon,
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [range, setRange] = useState<'daily' | 'weekly'>('daily');
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getHistory(range);
        setEntries(data);
      } catch {
        setError('히스토리를 불러오지 못했어요');
      }
    }
    fetchHistory();
  }, [range]);

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display text-coral-dark">히스토리</h1>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as 'daily' | 'weekly')}
            className="rounded-xl border border-cream-dark px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-coral/40"
          >
            <option value="daily">일간</option>
            <option value="weekly">주간</option>
          </select>
        </div>

        {entries.length === 0 && <p className="text-sm text-ink-soft text-center py-6">아직 기록이 없어요</p>}

        <ul className="space-y-2">
          {entries.map((e, i) => {
            const Icon = CATEGORY_ICON[e.category] ?? StarIcon;
            const tint = CATEGORY_TINT[e.category as keyof typeof CATEGORY_TINT] ?? CATEGORY_TINT.ETC;
            return (
              <li key={i} className="flex items-center gap-3 bg-white rounded-card shadow-sm px-5 py-3">
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: tint.light }}
                >
                  <Icon color={tint.dark} className="w-4 h-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm text-ink-soft">{e.date}</p>
                  <span className="text-xs font-semibold text-mint-dark bg-mint-light px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </span>
                </div>
                <p className="font-display text-lg text-coral-dark">{e.verifiedSeconds}초</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Layout>
  );
}
