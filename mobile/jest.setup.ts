jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBase: 'http://localhost:4000',
      googleClientId: '',
      kakaoClientId: '',
    },
  },
}));

jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn().mockImplementation(() => ({
    promptAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  })),
  ResponseType: { IdToken: 'id_token', Token: 'token', Code: 'code' },
  makeRedirectUri: jest.fn(() => 'exp://127.0.0.1:8081'),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-nonce'),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
