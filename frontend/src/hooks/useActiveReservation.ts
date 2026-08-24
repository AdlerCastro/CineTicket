'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

// Espelha ActiveReservationResponse de
// backend/src/modules/reservations/dto/active-reservation.dto.ts (D54) —
// shape mínimo, não o Reservation completo (ver conversão em sessions/[id]).
export interface ActiveReservation {
  reservationId: string;
  seatId: string;
  expiresAt: string;
}

export const activeReservationKey = (sessionId: string) =>
  ['reservations', 'mine', 'active', sessionId] as const;

// D54: reidrata o ReservationPanel ao montar /sessions/[id] quando o
// customer já tem uma Reservation PENDING ativa nesta sessão (ex.: saiu da
// tela sem pagar e voltou) — GET /reservations/mine/active devolve 204 (sem
// corpo) quando não há nenhuma, tratado como `undefined` pelo apiClient.
export function useActiveReservation(sessionId: string) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: activeReservationKey(sessionId),
    queryFn: () =>
      apiClient.get<ActiveReservation | undefined>(
        `/reservations/mine/active?sessionId=${sessionId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    enabled: Boolean(sessionId) && isAuthenticated,
  });
}
