import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current stage and category', async () => {
    // HomePage now also renders ActivityHeatmap, which calls GET /api/history —
    // the mock has to branch on the URL since the two endpoints return different shapes.
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/history')) {
        return Promise.resolve({ ok: true, json: async () => [] });
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
      expect(screen.getByText(/1단계/)).toBeInTheDocument();
    });
  });
});
