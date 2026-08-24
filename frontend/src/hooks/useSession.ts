'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionKey } from '@/constants/query-keys';
import { useAuth } from '@/hooks/useAuth';
import type { Session } from '@/types/session';

// D57: mesma regra de useSessions.ts — envia Authorization quando
// autenticado, pra continuar enxergando a própria sessão rascunho (backend
// devolve 404 pra quem não é dono, risco #6 fechado em project-state.md).
export function useSession(sessionId: string) {
  const { accessToken, isHydrated } = useAuth();

  const query = useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () =>
      apiClient.get<Session>(`/sessions/${sessionId}`, {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      }),
    enabled: Boolean(sessionId) && isHydrated,
  });

  return { ...query, isLoading: query.isLoading || !isHydrated };
}
