import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
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
      <AuthProvider>
        <MemoryRouter>
          <ActivitySelectPage />
        </MemoryRouter>
      </AuthProvider>
    );

    // The category pill also renders "독서" (READING's label), so the activity
    // is looked up via its button's accessible name instead of a bare text match.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /독서/ })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('활동 이름'), { target: { value: '새 활동' } });
    fireEvent.click(screen.getByText('활동 만들기'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error message when listActivities fails instead of crashing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid token' }),
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <ActivitySelectPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('활동 목록을 불러오지 못했어요')).toBeInTheDocument();
    });
  });
});
