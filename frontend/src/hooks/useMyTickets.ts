'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { TicketDisplay } from '@/types/ticket';

export const myTicketsKey = ['tickets', 'mine'] as const;

// GET /tickets/mine (D53) — todos os ingressos do customer autenticado,
// mais recente primeiro (ordenação já vem do backend). Mesmo padrão de
// enabled/Authorization de useTicket.ts.
export function useMyTickets() {
  const { accessToken, isHydrated } = useAuth();

  return useQuery({
    queryKey: myTicketsKey,
    queryFn: () =>
      apiClient.get<TicketDisplay[]>('/tickets/mine', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    enabled: isHydrated && Boolean(accessToken),
  });
}
