import { useEffect, useRef, useState } from 'react';
import { startSession, sendHeartbeat, endSession } from '../api/sessions';

const HEARTBEAT_MS = 30_000;

export function useFocusTimer(activityId: string) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Mirrors `isPaused` but updates synchronously inside the event handler,
  // so the interval callback below always sees the current value even if
  // React hasn't re-rendered (and thus re-run the interval effect) yet.
  // Relying on `isPaused` state alone would let a stale interval closure
  // fire one extra heartbeat between the visibility change and the next render.
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    startSession(activityId)
      .then(({ id }) => {
        if (!cancelled) sessionIdRef.current = id;
      })
      .catch((err) => {
        // Without this catch, a failed startSession (e.g. a non-OK response,
        // which now throws per api/sessions.ts) would be an unhandled
        // rejection since nothing else awaits this promise.
        if (!cancelled) setError(err instanceof Error ? err.message : '세션 시작에 실패했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    function handleVisibilityChange() {
      const hidden = document.visibilityState === 'hidden';
      pausedRef.current = hidden;
      setIsPaused(hidden);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (pausedRef.current || !sessionIdRef.current) return;
      try {
        const { verifiedSeconds } = await sendHeartbeat(sessionIdRef.current);
        setElapsedSeconds(verifiedSeconds);
        setError(null);
      } catch (err) {
        // Same reasoning as above: setInterval's callback is not awaited by
        // anyone, so a thrown/rejected heartbeat call must be caught here.
        setError(err instanceof Error ? err.message : '하트비트 전송에 실패했습니다.');
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  async function end() {
    if (!sessionIdRef.current) return 0;
    const id = sessionIdRef.current;
    const { verifiedSeconds } = await endSession(id);
    // Clear the session id so the still-running heartbeat interval's guard
    // (`!sessionIdRef.current`) stops it from firing against an already-
    // ended session if the user lingers on the result view.
    sessionIdRef.current = null;
    setElapsedSeconds(verifiedSeconds);
    return verifiedSeconds;
  }

  return { elapsedSeconds, isPaused, error, end };
}
