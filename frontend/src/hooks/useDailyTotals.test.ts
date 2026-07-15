import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as historyApi from '../api/history';
import { useDailyTotals } from './useDailyTotals';

vi.mock('../api/history');

describe('useDailyTotals', () => {
  it('sums verifiedSeconds per date across categories', async () => {
    (historyApi.getHistory as any).mockResolvedValue([
      { date: '2026-07-14', category: 'STUDY', verifiedSeconds: 300 },
      { date: '2026-07-14', category: 'EXERCISE', verifiedSeconds: 200 },
      { date: '2026-07-13', category: 'READING', verifiedSeconds: 100 },
    ]);

    const { result } = renderHook(() => useDailyTotals('weekly'));

    await waitFor(() => {
      expect(result.current.totalsByDate).toEqual({
        '2026-07-14': 500,
        '2026-07-13': 100,
      });
    });
    expect(historyApi.getHistory).toHaveBeenCalledWith('weekly');
  });

  it('sets an error message when the request fails', async () => {
    (historyApi.getHistory as any).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDailyTotals('daily'));

    await waitFor(() => {
      expect(result.current.error).toBe('데이터를 불러오지 못했어요');
    });
  });
});
