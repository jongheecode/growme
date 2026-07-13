import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthState {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('growme_token'));

  const login = (newToken: string) => {
    localStorage.setItem('growme_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('growme_token');
    setToken(null);
  };

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
