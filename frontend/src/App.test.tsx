import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the home page', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' }),
    }) as any;

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/STUDY/)).toBeInTheDocument();
    });
  });
});
