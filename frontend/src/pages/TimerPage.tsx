import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFocusTimer } from '../hooks/useFocusTimer';

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
      <div>
        <p>이번 세션 인증 시간: {result}초</p>
        <button onClick={() => navigate('/')}>홈으로</button>
      </div>
    );
  }

  return (
    <div>
      <p>{isPaused ? '일시정지됨' : '진행 중'}</p>
      <p>{elapsedSeconds}초</p>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleEnd}>종료</button>
    </div>
  );
}
