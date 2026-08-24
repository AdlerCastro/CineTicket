'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { TicketDisplay } from '@/types/ticket';

export const ticketKey = (ticketId: string) => ['tickets', ticketId] as const;

// GET /tickets/:id — restrito ao customer dono da Reservation original
// (403 pra qualquer outro usuário, ver tickets.service.ts#findByIdForCustomer
// no backend). `enabled` também depende do accessToken já carregado, senão a
// primeira chamada sai sem Authorization e recebe 401 à toa.
export function useTicket(ticketId: string) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ticketKey(ticketId),
    queryFn: () =>
      apiClient.get<TicketDisplay>(`/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    enabled: Boolean(ticketId) && Boolean(accessToken),
  });
}
