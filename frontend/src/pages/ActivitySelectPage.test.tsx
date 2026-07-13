import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ActivitySelectPage from './ActivitySelectPage';

describe('ActivitySelectPage', () => {
  it('lists existing activities and creates a new one', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'a1', name: '독서', category: 'READING' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'a2', name: '새 활동', category: 'ETC' }),
      });

    render(
      <MemoryRouter>
        <ActivitySelectPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('독서')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('활동 이름'), { target: { value: '새 활동' } });
    fireEvent.click(screen.getByText('활동 만들기'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
