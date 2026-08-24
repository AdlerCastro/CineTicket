'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useSeatMap } from '@/hooks/useSeatMap';
import { useSessionSocket } from '@/hooks/useSessionSocket';
import { useSeatSelection } from '@/hooks/useSeatSelection';
import { useActiveReservation } from '@/hooks/useActiveReservation';
import { useAuth } from '@/hooks/useAuth';
import { SeatMap } from '@/components/organisms/SeatMap';
import { ReservationPanel } from '@/components/organisms/ReservationPanel';
import { formatSessionDateTime } from '@/lib/utils';
import { ReservationStatus } from '@/enums/reservation-status.enum';
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
  const { user, isAuthenticated } = useAuth();

  // D54: reidrata o painel a partir do backend quando o customer já tem uma
  // Reservation PENDING ativa nesta sessão — sem isso o estado local começa
  // sempre nulo e o painel mostra "escolha um assento" apesar do assento já
  // travado no backend (ver .context/project-state.md, risco #16/D52).
  const { data: activeReservation, isLoading: checkingActiveReservation } =
    useActiveReservation(sessionId);

  useEffect(() => {
    // Guardas contra sobrescrever um estado local mais recente: reserva já
    // criada nesta visita (`reservation`) ou seleção manual em andamento
    // (`selectedSeatId`) — ambos legítimos e mais frescos que o snapshot do
    // GET, que só reflete o que existia no momento em que a página montou.
    if (!activeReservation || reservation || selectedSeatId) return;
    setReservation({
      id: activeReservation.reservationId,
      sessionId,
      seatId: activeReservation.seatId,
      customerId: user?.id ?? '',
      status: ReservationStatus.PENDING,
      expiresAt: activeReservation.expiresAt,
      // Não vêm de GET /reservations/mine/active (shape mínimo, D54) e não
      // são lidos em nenhum lugar do render do ReservationPanel — placeholder
      // sem significado, nunca exibido.
      createdAt: activeReservation.expiresAt,
      updatedAt: activeReservation.expiresAt,
    });
  }, [activeReservation, reservation, selectedSeatId, sessionId, user?.id]);

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
          disabled={
            Boolean(reservation) ||
            (isAuthenticated && checkingActiveReservation)
          }
          onSelectSeat={(seat) => {
            if (seat.status === 'AVAILABLE') toggleSeat(seat.id);
          }}
        />
        <ReservationPanel
          session={session}
          seats={seats ?? []}
          selectedSeatId={selectedSeatId}
          reservation={reservation}
          isCheckingActiveReservation={
            isAuthenticated && checkingActiveReservation
          }
          onReservationChange={setReservation}
          onClearSelection={clearSelection}
          onReset={() => {
            setReservation(null);
            clearSelection();
          }}
        />
      </div>
    </div>
  );
}
