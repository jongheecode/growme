import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';
import Layout from '../components/Layout';
import { KkumiCharacter } from '../components/KkumiCharacter';
import ActivityHeatmap from '../components/ActivityHeatmap';

export default function HomePage() {
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

  return (
    <Layout>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
        <div className="bg-white rounded-card shadow-sm p-8 text-center space-y-3">
          <div className="w-40 h-40 mx-auto">
            <KkumiCharacter stage={growth.stage} category={growth.dominantCategory} />
          </div>
          <p className="text-lg font-bold text-coral-dark">{growth.dominantCategory} 꾸미</p>
          <span className="inline-block bg-mint-light text-mint-dark text-sm font-semibold px-3 py-1 rounded-full">
            {growth.stage}단계
          </span>
          <p className="text-sm text-ink-soft">누적 게이지: {growth.currentGauge}초</p>
          <button
            onClick={() => navigate('/activities')}
            className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-full py-3 transition-colors mt-2"
          >
            타이머 시작
          </button>
        </div>

        <ActivityHeatmap />
      </div>
    </Layout>
  );
}
