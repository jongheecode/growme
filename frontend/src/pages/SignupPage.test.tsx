import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import SignupPage from './SignupPage';

describe('SignupPage', () => {
  it('submits nickname, email and password to signup and logs in', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ token: 'abc', user: { id: '1', email: 'a@b.com', nickname: 'A' } }),
    }) as any;

    render(
      <MemoryRouter>
        <AuthProvider>
          <SignupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '테스터' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('회원가입'));

    await waitFor(() => {
      expect(localStorage.getItem('growme_token')).toBe('abc');
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/signup'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows an error message when signup fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'email already registered' }),
    }) as any;

    render(
      <MemoryRouter>
        <AuthProvider>
          <SignupPage />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '테스터' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('회원가입'));

    await waitFor(() => {
      expect(screen.getByText('회원가입에 실패했어요')).toBeInTheDocument();
    });
  });
});
