import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProfilePage from './ProfilePage';

function mockFetchSequence(responses: {
  me: any;
  growth: any;
  patched?: any;
  changePasswordOk?: boolean;
}) {
  globalThis.fetch = vi.fn((url: string, options?: RequestInit) => {
    if (url.includes('/growth/me')) {
      return Promise.resolve({ ok: true, json: async () => responses.growth });
    }
    if (url.includes('/auth/change-password')) {
      return Promise.resolve({ ok: responses.changePasswordOk ?? true, json: async () => ({}) });
    }
    if (url.includes('/users/me') && options?.method === 'PATCH') {
      return Promise.resolve({ ok: true, json: async () => responses.patched ?? responses.me });
    }
    if (url.includes('/users/me') && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url.includes('/users/me')) {
      return Promise.resolve({ ok: true, json: async () => responses.me });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as any;
}

describe('ProfilePage', () => {
  it('shows profile info and saves bio', async () => {
    mockFetchSequence({
      me: { id: '1', email: 'a@b.com', nickname: '테스터', bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
      growth: { currentGauge: 3700, stage: 1, dominantCategory: 'STUDY' },
      patched: { id: '1', email: 'a@b.com', nickname: '테스터', bio: '안녕하세요', createdAt: '2026-01-01T00:00:00.000Z' },
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('테스터')).toBeInTheDocument();
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('한줄소개'), { target: { value: '안녕하세요' } });
    fireEvent.click(screen.getByText('저장'));

    await waitFor(() => {
      expect(screen.getByText('저장했어요')).toBeInTheDocument();
    });
  });

  it('shows an error message when changing password fails', async () => {
    mockFetchSequence({
      me: { id: '1', email: 'a@b.com', nickname: '테스터', bio: null, createdAt: '2026-01-01T00:00:00.000Z' },
      growth: { currentGauge: 0, stage: 0, dominantCategory: 'ETC' },
      changePasswordOk: false,
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('테스터')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('비밀번호 변경'));

    await waitFor(() => {
      expect(screen.getByText('비밀번호 변경에 실패했어요')).toBeInTheDocument();
    });
  });
});
