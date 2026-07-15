import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFocusTimer } from '../hooks/useFocusTimer';
import Layout from '../components/Layout';

export default function TimerPage() {
  const { activityId } = useParams();
  const { elapsedSeconds, isPaused, error: timerError, end } = useFocusTimer(activityId!);
  const [result, setResult] = useState<number | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const navigate = useNavigate();
  const error = endError ?? timerError;

  async function handleEnd() {
    setEndError(null);
    try {
      const finalSeconds = await end();
      setResult(finalSeconds);
    } catch {
      setEndError('세션 종료에 실패했습니다. 다시 시도해주세요.');
    }
  }

  if (result !== null) {
    return (
      <Layout>
        <div className="w-full max-w-sm bg-white rounded-card shadow-sm p-8 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <p className="text-ink">
            이번 세션 인증 시간: <span className="font-bold text-coral-dark">{result}초</span>
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-full py-3 transition-colors"
          >
            홈으로
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-sm bg-white rounded-card shadow-sm p-8 text-center space-y-4">
        <span
          className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${
            isPaused ? 'bg-honey/30 text-ink-soft' : 'bg-mint-light text-mint-dark'
          }`}
        >
          {isPaused ? '일시정지됨' : '진행 중'}
        </span>
        <p className="text-5xl font-bold text-coral-dark tabular-nums">{elapsedSeconds}초</p>
        {error && (
          <p role="alert" className="text-sm text-coral-dark">
            {error}
          </p>
        )}
        <button
          onClick={handleEnd}
          className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-full py-3 transition-colors"
        >
          종료
        </button>
      </div>
    </Layout>
  );
}
