jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        apiBase: 'http://localhost:4000',
      },
    },
  },
}));

import { login, signup } from './auth';

describe('login', () => {
  it('returns the token on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ token: 'abc123' }) })
    ) as unknown as typeof fetch;

    const token = await login('a@b.com', 'password123');
    expect(token).toBe('abc123');
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, json: async () => ({ error: 'invalid credentials' }) })
    ) as unknown as typeof fetch;

    await expect(login('a@b.com', 'wrong')).rejects.toThrow('로그인에 실패했어요');
  });
});

describe('signup', () => {
  it('returns the token on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ token: 'xyz789' }) })
    ) as unknown as typeof fetch;

    const token = await signup('a@b.com', 'password123', '닉네임');
    expect(token).toBe('xyz789');
  });
});
