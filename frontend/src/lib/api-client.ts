import type { LoginResponse } from '@/types/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:3333';

const REFRESH_PATH = '/auth/refresh';
const LOGOUT_PATH = '/auth/logout';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Ponte pro estado React de auth (useAuth.tsx é quem registra, ao montar o
// AuthProvider) — este módulo não é um componente/hook, não pode ter
// useState próprio, mas é aqui que o 401 de uma chamada autenticada
// acontece de fato, então é aqui que o refresh silencioso (Tarefa 2) e o
// retry precisam morar. `onTokenRefreshed` propaga o novo accessToken (e o
// `user`, que o próprio /auth/refresh já retorna) pro estado React +
// localStorage; `onSessionExpired` limpa a sessão local quando o refresh
// falha de vez (comportamento atual mantido — vira o mesmo 401 que já
// existia antes desta tarefa, e as telas que já tratavam esse caso — ex.
// ReservationPanel — continuam redirecionando pro /login como sempre).
interface AuthBridge {
  onTokenRefreshed: (accessToken: string, user: LoginResponse['user']) => void;
  onSessionExpired: () => void;
}

let authBridge: AuthBridge | null = null;

export function registerAuthBridge(bridge: AuthBridge): void {
  authBridge = bridge;
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    // refreshToken do backend vem em cookie httpOnly (ver auth.controller.ts)
    // — precisa ir/voltar em toda chamada para o cookie ter efeito.
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError(response.status, body || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Dedup de refresh concorrente: se várias chamadas autenticadas em paralelo
// caírem em 401 ao mesmo tempo (cenário real: várias queries do TanStack
// Query disparando juntas), só a primeira cria a promise de
// POST /auth/refresh — as demais aguardam essa mesma promise em vez de
// disparar a própria chamada, o que queimaria a rotação do refresh token
// (D58 rotaciona a cada uso) e faria chamadas paralelas pisarem uma na
// outra. `onTokenRefreshed`/`onSessionExpired` disparam uma única vez aqui
// (não em cada chamador que aguarda a promise), pelo mesmo motivo.
let refreshPromise: Promise<LoginResponse> | null = null;

function refreshSession(): Promise<LoginResponse> {
  if (!refreshPromise) {
    refreshPromise = rawRequest<LoginResponse>(REFRESH_PATH, {
      method: 'POST',
    })
      .then((session) => {
        authBridge?.onTokenRefreshed(session.accessToken, session.user);
        return session;
      })
      .catch((error: unknown) => {
        authBridge?.onSessionExpired();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function hasAuthorizationHeader(init?: RequestInit): boolean {
  const headers = init?.headers;
  if (!headers || Array.isArray(headers) || headers instanceof Headers) {
    return false;
  }
  return 'Authorization' in headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await rawRequest<T>(path, init);
  } catch (error) {
    // Refresh silencioso só se aplica a 401 de uma chamada que já ia
    // autenticada (tinha Authorization) — e nunca para os próprios
    // endpoints de auth, senão uma falha real de refresh (refresh token
    // também expirado/inválido) viraria loop tentando se renovar sozinho.
    const eligibleForRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      path !== REFRESH_PATH &&
      path !== LOGOUT_PATH &&
      hasAuthorizationHeader(init);

    if (!eligibleForRefresh) {
      throw error;
    }

    try {
      const refreshed = await refreshSession();
      return await rawRequest<T>(path, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${refreshed.accessToken}`,
        },
      });
    } catch {
      // Refresh falhou (ou o retry falhou de novo) — propaga o 401
      // original, sem loop de novas tentativas. Quem já tratava esse 401
      // (ex.: ReservationPanel, useRequireRole via isAuthenticated) continua
      // se comportando exatamente como antes desta tarefa.
      throw error;
    }
  }
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'DELETE' }),
};
