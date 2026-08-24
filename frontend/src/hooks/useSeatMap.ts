'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionSeatsKey } from '@/constants/query-keys';
import { useAuth } from '@/hooks/useAuth';
import type { SeatMapItem } from '@/types/seat';

// D57: mesma regra de useSessions.ts — GET /sessions/:id/seats passou a
// resolver a sessão via SessionsService.findOne por baixo (risco #6),
// então também precisa do Authorization pra continuar mostrando o mapa da
// própria sessão rascunho.
export function useSeatMap(sessionId: string) {
  const { accessToken, isHydrated } = useAuth();

  const query = useQuery({
    queryKey: sessionSeatsKey(sessionId),
    queryFn: () =>
      apiClient.get<SeatMapItem[]>(`/sessions/${sessionId}/seats`, {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      }),
    enabled: Boolean(sessionId) && isHydrated,
  });

  return { ...query, isLoading: query.isLoading || !isHydrated };
}
