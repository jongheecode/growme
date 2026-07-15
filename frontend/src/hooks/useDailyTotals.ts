import { useEffect, useState } from 'react';
import { getHistory } from '../api/history';

export function useDailyTotals(range: 'daily' | 'weekly') {
  const [totalsByDate, setTotalsByDate] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const entries = await getHistory(range);
        const totals: Record<string, number> = {};
        for (const e of entries) {
          totals[e.date] = (totals[e.date] ?? 0) + e.verifiedSeconds;
        }
        if (!cancelled) setTotalsByDate(totals);
      } catch {
        if (!cancelled) setError('데이터를 불러오지 못했어요');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  return { totalsByDate, error };
}
