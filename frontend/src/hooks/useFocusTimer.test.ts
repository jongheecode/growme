import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sessionsApi from '../api/sessions';
import { useFocusTimer } from './useFocusTimer';

vi.mock('../api/sessions');

describe('useFocusTimer', () => {
  beforeEach(() => {
    // shouldAdvanceTime is required: RTL's `waitFor`/`act` internals rely on
    // real timer flushing to settle promises, which deadlocks under plain
    // vi.useFakeTimers() (no global `jest`, so testing-library's fake-timer
    // detection doesn't kick in and its polling never advances).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    (sessionsApi.startSession as any).mockResolvedValue({ id: 'session-1' });
    (sessionsApi.sendHeartbeat as any).mockResolvedValue({ verifiedSeconds: 30 });
    (sessionsApi.endSession as any).mockResolvedValue({ verifiedSeconds: 60 });
  });

  it('starts a session and sends heartbeats every 30 seconds', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));

    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalledWith('activity-1'));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(sessionsApi.sendHeartbeat).toHaveBeenCalledWith('session-1');
  });

  it('does not send heartbeats while the tab is hidden', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));
    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalled());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(sessionsApi.sendHeartbeat).not.toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
  });

  it('ends the session when end() is called', async () => {
    const { result } = renderHook(() => useFocusTimer('activity-1'));
    await waitFor(() => expect(sessionsApi.startSession).toHaveBeenCalled());

    let finalSeconds = 0;
    await act(async () => {
      finalSeconds = await result.current.end();
    });

    expect(sessionsApi.endSession).toHaveBeenCalledWith('session-1');
    expect(finalSeconds).toBe(60);
  });
});
