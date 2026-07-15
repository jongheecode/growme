import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current stage, category, and computed stats', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ date: new Date().toISOString().slice(0, 10), category: 'STUDY', verifiedSeconds: 600 }],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' }),
      });
    }) as any;

    render(
      <AuthProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText('LV.1')).toBeInTheDocument();
      expect(screen.getByText('1일')).toBeInTheDocument(); // 오늘 기록이 있으므로 연속 1일
      expect(screen.getByText('1h')).toBeInTheDocument(); // 3700초 -> 1시간
      expect(screen.getByText('0개')).toBeInTheDocument(); // 뱃지는 아직 실데이터 없음
    });
  });
});
