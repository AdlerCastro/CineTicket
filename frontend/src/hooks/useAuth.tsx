'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from '@/lib/auth-storage';
import type { AuthenticatedUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, user: AuthenticatedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// D12: estado client-side puro (sessão de auth em memória/localStorage) via
// Context + useState — sem Zustand.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadAuthSession();
    if (stored) {
      setUser(stored.user);
      setAccessToken(stored.accessToken);
    }
  }, []);

  const login = useCallback((token: string, authUser: AuthenticatedUser) => {
    setAccessToken(token);
    setUser(authUser);
    saveAuthSession({ accessToken: token, user: authUser });
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    clearAuthSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: accessToken !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
