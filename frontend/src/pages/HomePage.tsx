import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrowthState, getMyGrowth } from '../api/growth';

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

  if (error) return <p>{error}</p>;
  if (!growth) return <p>불러오는 중...</p>;

  return (
    <div>
      <p>{growth.dominantCategory} 꾸미</p>
      <p>{growth.stage}단계</p>
      <p>누적 게이지: {growth.currentGauge}초</p>
      <button onClick={() => navigate('/activities')}>타이머 시작</button>
    </div>
  );
}
