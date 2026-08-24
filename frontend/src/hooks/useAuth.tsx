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
  // Sprint 4: true só depois da leitura inicial de localStorage — guards de
  // rota por papel (useRequireRole) precisam disso pra não redirecionar
  // erroneamente pro /login num primeiro render em que a sessão ainda não
  // foi carregada (o useEffect abaixo é assíncrono em relação ao mount).
  isHydrated: boolean;
  login: (accessToken: string, user: AuthenticatedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// D12: estado client-side puro (sessão de auth em memória/localStorage) via
// Context + useState — sem Zustand.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = loadAuthSession();
    if (stored) {
      setUser(stored.user);
      setAccessToken(stored.accessToken);
    }
    setIsHydrated(true);
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
        isHydrated,
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
