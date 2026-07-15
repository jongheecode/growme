import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';
import Layout from '../components/Layout';

const CATEGORY_LABEL: Record<string, string> = {
  EXERCISE: '운동',
  STUDY: '학업',
  READING: '독서',
  ETC: '기타',
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
          <h1 className="text-xl font-bold text-coral-dark">히스토리</h1>
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
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between bg-white rounded-card shadow-sm px-5 py-3">
              <div>
                <p className="text-sm text-ink-soft">{e.date}</p>
                <span className="text-xs font-semibold text-mint-dark bg-mint-light px-2 py-0.5 rounded-full">
                  {CATEGORY_LABEL[e.category] ?? e.category}
                </span>
              </div>
              <p className="font-bold text-coral-dark">{e.verifiedSeconds}초</p>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
