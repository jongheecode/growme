const mockPromptAsync = jest.fn();

jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn().mockImplementation(() => ({ promptAsync: mockPromptAsync })),
  ResponseType: { IdToken: 'id_token', Token: 'token', Code: 'code' },
  makeRedirectUri: jest.fn(() => 'exp://127.0.0.1:8081'),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-nonce'),
}));

import Constants from 'expo-constants';
import { requestGoogleIdToken, requestKakaoAccessToken } from './oauth';

beforeEach(() => {
  jest.clearAllMocks();
  (Constants as any).expoConfig.extra.googleClientId = 'test-google-client-id';
  (Constants as any).expoConfig.extra.kakaoClientId = 'test-kakao-client-id';
});

describe('requestGoogleIdToken', () => {
  it('returns the id_token on success', async () => {
    mockPromptAsync.mockResolvedValueOnce({ type: 'success', params: { id_token: 'abc-id-token' } });
    await expect(requestGoogleIdToken()).resolves.toBe('abc-id-token');
  });

  it('throws when the user cancels', async () => {
    mockPromptAsync.mockResolvedValueOnce({ type: 'cancel' });
    await expect(requestGoogleIdToken()).rejects.toThrow('구글 로그인이 취소됐어요');
  });
});

describe('requestKakaoAccessToken', () => {
  it('returns the access_token on success', async () => {
    mockPromptAsync.mockResolvedValueOnce({ type: 'success', params: { access_token: 'abc-access-token' } });
    await expect(requestKakaoAccessToken()).resolves.toBe('abc-access-token');
  });

  it('throws when the user cancels', async () => {
    mockPromptAsync.mockResolvedValueOnce({ type: 'cancel' });
    await expect(requestKakaoAccessToken()).rejects.toThrow('카카오 로그인이 취소됐어요');
  });
});
