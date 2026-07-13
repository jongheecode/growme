import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory } from '../api/history';

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

  if (error) return <p>{error}</p>;

  return (
    <div>
      <select value={range} onChange={(e) => setRange(e.target.value as 'daily' | 'weekly')}>
        <option value="daily">일간</option>
        <option value="weekly">주간</option>
      </select>
      <ul>
        {entries.map((e, i) => (
          <li key={i}>
            {e.date} - {e.category}: {e.verifiedSeconds}초
          </li>
        ))}
      </ul>
    </div>
  );
}
