'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { sessionsKey } from '@/constants/query-keys';
import { useAuth } from '@/hooks/useAuth';
import type { Session } from '@/types/session';

// D57: GET /sessions agora filtra published/dono no backend (risco #6) —
// uma sessão published:false só volta pro organizerId dono. Envia
// Authorization quando o usuário está autenticado, sem exigir login —
// visitante anônimo continua igual (D32), só deixa de ver rascunho alheio.
// `enabled`/`isLoading` esperam isHydrated pra não disparar a primeira
// chamada anônima antes do token existir (mesmo padrão de
// useMyTickets.ts/useActiveReservation.ts) — sem isso, o organizador correria
// risco de buscar os próprios rascunhos sem token no primeiro render e ficar
// preso nesse resultado (cache não refaz sozinho só porque o token chegou).
export function useSessions() {
  const { accessToken, isHydrated } = useAuth();

  const query = useQuery({
    queryKey: sessionsKey,
    queryFn: () =>
      apiClient.get<Session[]>('/sessions', {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      }),
    enabled: isHydrated,
  });

  return { ...query, isLoading: query.isLoading || !isHydrated };
}
