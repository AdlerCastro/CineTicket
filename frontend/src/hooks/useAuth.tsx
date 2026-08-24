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
import { apiClient, registerAuthBridge } from '@/lib/api-client';
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
  // D58/Tarefa 1: agora chama POST /auth/logout de verdade (invalidação
  // real no servidor), por isso passou a ser assíncrono — ver corpo da
  // função abaixo pra decisão de comportamento em falha de rede.
  logout: () => Promise<void>;
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

  // Limpa só o estado local (React + localStorage), sem chamar a API —
  // reaproveitado tanto por logout() (depois do POST /auth/logout, Tarefa 1)
  // quanto pela ponte com api-client.ts quando um refresh silencioso falha
  // de vez (Tarefa 2): nesse segundo caso o servidor já considera a sessão
  // inválida, não há nada a invalidar de novo, só sincronizar o frontend.
  const clearLocalSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    clearAuthSession();
  }, []);

  // TAREFA 1: invalida no servidor ANTES de limpar o estado local — não
  // depois, não em paralelo sem aguardar. POST /auth/logout zera o
  // refreshTokenHash real (D58); sem aguardar essa chamada antes de limpar
  // local, o cookie httpOnly que o navegador ainda guarda continuaria
  // válido em /auth/refresh mesmo depois do usuário "sair" pela UI.
  //
  // Decisão sobre falha de rede (documentada, ambas as opções eram
  // defensáveis): limpa o estado local mesmo assim. Manter a UI presa em
  // "logado" quando o usuário clicou explicitamente em sair seria pior UX
  // do que o pior caso do lado do servidor — um refreshTokenHash que
  // simplesmente expira sozinho em 7 dias sem nunca mais ser usado. O
  // logout do backend já é idempotente e não exige access token válido
  // (D58: `ignoreExpiration: true`), então não há custo extra em tentar de
  // novo silenciosamente numa sessão futura se o usuário logar de novo.
  const logout = useCallback(async () => {
    try {
      await apiClient.post<void>('/auth/logout');
    } catch {
      // Rede fora do ar ou erro do servidor — segue para limpar local mesmo
      // assim, ver justificativa acima.
    }
    clearLocalSession();
  }, [clearLocalSession]);

  // Ponte com lib/api-client.ts (Tarefa 2): o 401 de uma chamada autenticada
  // e o retry pós-refresh acontecem lá (é onde a chamada original existe),
  // mas quem é dono do estado React de accessToken/user é este provider —
  // registra como propagar o resultado sem que cada um dos ~11 call sites
  // que já passam Authorization manualmente precise saber que isso existe.
  useEffect(() => {
    registerAuthBridge({
      onTokenRefreshed: (token, refreshedUser) => {
        setAccessToken(token);
        setUser(refreshedUser);
        saveAuthSession({ accessToken: token, user: refreshedUser });
      },
      onSessionExpired: clearLocalSession,
    });
  }, [clearLocalSession]);

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
