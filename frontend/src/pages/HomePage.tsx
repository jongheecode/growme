import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';
import Layout from '../components/Layout';
import { KkumiCharacter } from '../components/KkumiCharacter';
import ActivityHeatmap from '../components/ActivityHeatmap';
import StatBadge from '../components/StatBadge';
import { BoltIcon } from '../components/icons/BoltIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import { StarIcon } from '../components/icons/StarIcon';
import { useDailyTotals } from '../hooks/useDailyTotals';
import { computeCurrentStreak } from '../utils/streak';

export default function HomePage() {
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { totalsByDate } = useDailyTotals('weekly');

  useEffect(() => {
    async function fetchGrowth() {
      try {
        const data = await getMyGrowth();
        setGrowth(data);
      } catch {
        setError('성장 정보를 불러오지 못했어요');
      }
    }
    fetchGrowth();
  }, []);

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }
  if (!growth) {
    return (
      <Layout>
        <p className="text-ink-soft">불러오는 중...</p>
      </Layout>
    );
  }

  const streak = computeCurrentStreak(totalsByDate);
  const accumulatedHours = Math.floor(growth.currentGauge / 3600);

  return (
    <Layout>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
        <div className="bg-white rounded-card shadow-sm p-8 text-center space-y-3">
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <circle cx="50" cy="50" r="47" fill="none" stroke="#ffd7e1" strokeWidth="4" />
            </svg>
            <div className="absolute inset-3">
              <KkumiCharacter stage={growth.stage} category={growth.dominantCategory} />
            </div>
            <span className="absolute bottom-0 right-0 bg-ink text-white text-xs font-display px-2 py-0.5 rounded-full">
              LV.{growth.stage}
            </span>
          </div>
          <p className="text-lg font-display text-coral-dark">{growth.dominantCategory} 꾸미</p>
          <div className="flex gap-2 pt-1">
            <StatBadge icon={<BoltIcon color="#e85d82" />} value={`${streak}일`} label="연속" tint="coral" />
            <StatBadge icon={<ClockIcon color="#3fbf99" />} value={`${accumulatedHours}h`} label="누적" tint="mint" />
            <StatBadge icon={<StarIcon color="#c98a00" />} value="0개" label="뱃지" tint="honey" />
          </div>
          <button
            onClick={() => navigate('/activities')}
            className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors mt-2"
          >
            타이머 시작
          </button>
        </div>

        <ActivityHeatmap />
      </div>
    </Layout>
  );
}
