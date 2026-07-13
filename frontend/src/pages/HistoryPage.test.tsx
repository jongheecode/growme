import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HistoryPage from './HistoryPage';

describe('HistoryPage', () => {
  it('renders history entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-07-13', category: 'STUDY', verifiedSeconds: 600 }],
    }) as any;

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText(/600/)).toBeInTheDocument();
    });
  });
});
