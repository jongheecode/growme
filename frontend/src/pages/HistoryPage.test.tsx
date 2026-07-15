import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import HistoryPage from './HistoryPage';

describe('HistoryPage', () => {
  it('renders history entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ date: '2026-07-13', category: 'STUDY', verifiedSeconds: 600 }],
    }) as any;

    render(
      <AuthProvider>
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      </AuthProvider>
    );

    // HistoryPage now shows the Korean category label ("학업"), not the raw
    // enum value, so the assertion follows what's actually rendered.
    await waitFor(() => {
      expect(screen.getByText(/학업/)).toBeInTheDocument();
      expect(screen.getByText(/600/)).toBeInTheDocument();
    });
  });
});
