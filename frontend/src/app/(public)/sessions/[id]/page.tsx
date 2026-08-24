'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useSeatMap } from '@/hooks/useSeatMap';
import { useSessionSocket } from '@/hooks/useSessionSocket';
import { useSeatSelection } from '@/hooks/useSeatSelection';
import { SeatMap } from '@/components/organisms/SeatMap';
import { ReservationPanel } from '@/components/organisms/ReservationPanel';
import { formatSessionDateTime } from '@/lib/utils';
import type { Reservation } from '@/types/reservation';

const WS_STATUS_LABEL = {
  connecting: 'Tempo real: conectando...',
  joined: 'Tempo real: conectado',
  error: 'Tempo real indisponível para esta sessão',
} as const;

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const {
    data: session,
    isLoading: loadingSession,
    isError: sessionError,
  } = useSession(sessionId);
  const { data: seats, isLoading: loadingSeats } = useSeatMap(sessionId);
  const wsStatus = useSessionSocket(sessionId);
  const { selectedSeatId, toggleSeat, clearSelection } = useSeatSelection();
  const [reservation, setReservation] = useState<Reservation | null>(null);

  if (loadingSession || loadingSeats) {
    return <p className='text-muted-foreground'>Carregando sessão...</p>;
  }

  if (sessionError || !session) {
    return <p className='text-destructive'>Sessão não encontrada.</p>;
  }

  return (
    <div>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='font-display text-3xl font-bold'>
            {session.movie.title}
          </h1>
          <p className='mt-1 text-muted-foreground'>
            Sala {session.room} — {formatSessionDateTime(session.startsAt)}
          </p>
        </div>
        {!session.published && (
          <span className='whitespace-nowrap rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground'>
            Rascunho
          </span>
        )}
      </div>

      <p className='mt-1 text-xs text-muted-foreground'>
        {WS_STATUS_LABEL[wsStatus]}
      </p>

      <div className='mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]'>
        <SeatMap
          seats={seats ?? []}
          selectedSeatId={selectedSeatId}
          highlightSeatId={reservation?.seatId ?? null}
          disabled={Boolean(reservation)}
          onSelectSeat={(seat) => {
            if (seat.status === 'AVAILABLE') toggleSeat(seat.id);
          }}
        />
        <ReservationPanel
          session={session}
          seats={seats ?? []}
          selectedSeatId={selectedSeatId}
          reservation={reservation}
          onReserved={setReservation}
          onClearSelection={clearSelection}
        />
      </div>
    </div>
  );
}
