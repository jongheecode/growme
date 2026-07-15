import { useEffect, useState } from 'react';
import { getHistory } from '../api/history';

const DAYS = 28;

function colorForSeconds(seconds: number) {
  if (seconds <= 0) return 'bg-cream-dark';
  if (seconds < 900) return 'bg-mint-light';
  if (seconds < 1800) return 'bg-mint';
  return 'bg-mint-dark';
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function ActivityHeatmap() {
  const [totalsByDate, setTotalsByDate] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // 'weekly' range returns the last 4 weeks of entries, which is what a
        // 28-day heatmap needs (there's no separate "monthly" range on the API).
        const entries = await getHistory('weekly');
        const totals: Record<string, number> = {};
        for (const e of entries) {
          totals[e.date] = (totals[e.date] ?? 0) + e.verifiedSeconds;
        }
        setTotalsByDate(totals);
      } catch {
        setError('히트맵을 불러오지 못했어요');
      }
    }
    load();
  }, []);

  if (error) return <p className="text-sm text-coral-dark">{error}</p>;

  const days = lastNDays(DAYS);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="bg-white rounded-card shadow-sm p-6 w-full">
      <p className="text-sm font-semibold text-ink-soft mb-4">최근 4주 활동</p>
      <div className="flex gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((date) => {
              const seconds = totalsByDate[date] ?? 0;
              return (
                <div
                  key={date}
                  title={`${date}: ${Math.round(seconds / 60)}분`}
                  className={`w-5 h-5 rounded ${colorForSeconds(seconds)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-4 text-xs text-ink-soft">
        <span>적음</span>
        <div className="w-3.5 h-3.5 rounded bg-cream-dark" />
        <div className="w-3.5 h-3.5 rounded bg-mint-light" />
        <div className="w-3.5 h-3.5 rounded bg-mint" />
        <div className="w-3.5 h-3.5 rounded bg-mint-dark" />
        <span>많음</span>
      </div>
    </div>
  );
}
