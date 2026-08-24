'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import type { TicketStatus } from '@/enums/ticket-status.enum';

// Espelha ValidatedTicketResponse de
// backend/src/modules/tickets/dto/ticket-display.dto.ts (D56) — shape
// mínimo, sem session/movie aninhados: a portaria já sabe qual sessão está
// exibindo o histórico (D46), reenviar o objeto inteiro por item seria dado
// redundante.
export interface ValidatedTicket {
  id: string;
  status: TicketStatus;
  usedAt: string;
  seat: {
    id: string;
    row: string;
    number: number;
  };
}

export const validatedTicketsKey = (sessionId: string) =>
  ['tickets', 'validated', sessionId] as const;

// D56: histórico persistente de ingressos validados na sessão selecionada na
// portaria. queryKey inclui sessionId — troca de sessão já dispara refetch
// sozinha. "Validação nova" (GateScanner, organism existente fora do escopo
// de arquivo autorizado desta tarefa) é coberta por polling curto em vez de
// um callback novo ali — decisão aceitável porque o histórico não tem
// requisito de tempo real (D56).
const REFETCH_INTERVAL_MS = 4000;

export function useValidatedTickets(sessionId: string) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: validatedTicketsKey(sessionId),
    queryFn: () =>
      apiClient.get<ValidatedTicket[]>(
        `/tickets/validated?sessionId=${sessionId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    enabled: Boolean(sessionId) && isAuthenticated,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
