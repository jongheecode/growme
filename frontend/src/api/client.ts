export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('growme_token');
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
