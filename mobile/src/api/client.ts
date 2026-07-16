import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const API_BASE =
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('growme_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  return res;
}
