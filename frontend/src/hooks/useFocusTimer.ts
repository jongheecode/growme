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
  // Last value confirmed by the server (heartbeat/start/end), and the wall-clock
  // time it was set. The 1s display ticker below extrapolates from these so the
  // timer visibly counts up between heartbeats instead of jumping every 30s.
  const baseSecondsRef = useRef(0);
  const syncedAtRef = useRef(Date.now());

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
      // Re-anchor so the paused duration itself isn't extrapolated as elapsed
      // time by the display ticker once the tab becomes visible again.
      syncedAtRef.current = Date.now();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (pausedRef.current || !sessionIdRef.current) return;
      try {
        const { verifiedSeconds } = await sendHeartbeat(sessionIdRef.current);
        baseSecondsRef.current = verifiedSeconds;
        syncedAtRef.current = Date.now();
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

  // Ticks the displayed number every second between heartbeats. The server
  // heartbeat response remains the source of truth (re-synced above); this
  // only smooths what the user sees so the timer doesn't look frozen for
  // up to 30s at a stretch.
  useEffect(() => {
    const tick = setInterval(() => {
      if (pausedRef.current || !sessionIdRef.current) return;
      const localElapsed = baseSecondsRef.current + Math.floor((Date.now() - syncedAtRef.current) / 1000);
      setElapsedSeconds(localElapsed);
    }, 1000);
    return () => clearInterval(tick);
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
