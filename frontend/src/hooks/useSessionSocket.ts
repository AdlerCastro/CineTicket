'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSeatSocket } from '@/lib/ws-client';
import { sessionSeatsKey } from '@/constants/query-keys';
import type { SeatMapItem } from '@/types/seat';
import type { SeatStatus } from '@/enums/seat-status.enum';

export type SessionSocketStatus = 'connecting' | 'joined' | 'error';

interface SeatUpdateEvent {
  seatId: string;
  status: SeatStatus;
}

// Conecta, entra na room da sessão e escuta seat:update — atualiza o cache
// do TanStack Query direto (setQueryData), nunca refetch/poll (TAREFA item 3).
export function useSessionSocket(sessionId: string): SessionSocketStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionSocketStatus>('connecting');

  useEffect(() => {
    if (!sessionId) return;

    setStatus('connecting');
    const socket = createSeatSocket();

    socket.on('connect', () => {
      socket.emit('join:session', { sessionId });
    });

    socket.on('join:ack', () => setStatus('joined'));

    // D40: refusado também para sessão published:false — esperado, não é bug.
    socket.on('join:error', () => setStatus('error'));

    socket.on('seat:update', (payload: SeatUpdateEvent) => {
      queryClient.setQueryData<SeatMapItem[]>(
        sessionSeatsKey(sessionId),
        (current) =>
          current?.map((seat) =>
            seat.id === payload.seatId
              ? { ...seat, status: payload.status }
              : seat,
          ) ?? current,
      );
    });

    socket.on('connect_error', () => setStatus('error'));

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [sessionId, queryClient]);

  return status;
}
