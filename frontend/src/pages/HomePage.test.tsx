import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('shows the current stage and category', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' }),
    }) as any;

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
      expect(screen.getByText(/1단계/)).toBeInTheDocument();
    });
  });
});
