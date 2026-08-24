'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useCountdown } from '@/hooks/useCountdown';
import { sessionSeatsKey } from '@/constants/query-keys';
import type { Session } from '@/types/session';
import type { SeatMapItem } from '@/types/seat';
import type { Reservation } from '@/types/reservation';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// `ApiError.message` guarda o corpo bruto da resposta (ver src/lib/api-client.ts) —
// o Nest devolve JSON ({ statusCode, message, error }), não texto plano.
function extractApiErrorMessage(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      return (parsed as { message: string }).message;
    }
  } catch {
    // corpo não era JSON — segue com null, tratado como mensagem genérica.
  }
  return null;
}

type PaymentDecision = 'APPROVE' | 'DECLINE';

interface ReservationPanelProps {
  session: Session;
  seats: SeatMapItem[];
  selectedSeatId: string | null;
  reservation: Reservation | null;
  onReservationChange: (reservation: Reservation) => void;
  onClearSelection: () => void;
  onReset: () => void;
}

export function ReservationPanel({
  session,
  seats,
  selectedSeatId,
  reservation,
  onReservationChange,
  onClearSelection,
  onReset,
}: ReservationPanelProps) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const remainingMs = useCountdown(
    reservation?.status === 'PENDING' ? reservation.expiresAt : null,
  );

  const loginRedirect = () =>
    router.push(
      `/login?redirect=${encodeURIComponent(`/sessions/${session.id}`)}`,
    );

  const reservationMutation = useMutation({
    mutationFn: () =>
      apiClient.post<Reservation>(
        '/reservations',
        { sessionId: session.id, seatId: selectedSeatId },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    onSuccess: (data) => {
      setError(null);
      onReservationChange(data);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          'Esse assento acabou de ser reservado por outra pessoa. Escolha outro.',
        );
        onClearSelection();
        queryClient.invalidateQueries({
          queryKey: sessionSeatsKey(session.id),
        });
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        // D44: 403 agora tem duas causas distintas — sessão não-publicada
        // (regra de negócio, usuário já está autenticado corretamente) vs.
        // guard de role/token (motivo real de sessão inválida). Redirecionar
        // pro login no primeiro caso seria enganoso: a pessoa já está logada,
        // o assento é que não pode ser reservado.
        const message = extractApiErrorMessage(err.message);
        if (message?.toLowerCase().includes('não publicada')) {
          setError(
            'Esta sessão ainda não foi publicada pelo organizador — não é possível reservar assentos.',
          );
          onClearSelection();
          return;
        }
        loginRedirect();
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        loginRedirect();
        return;
      }
      setError('Não foi possível confirmar a reserva. Tente novamente.');
    },
  });

  // TAREFA 1 (Sprint 4): decisão de pagamento sempre explícita — dois botões,
  // nunca aleatório/automático (D04). APPROVE gera Ticket no backend na mesma
  // transação; DECLINE libera o assento imediatamente via WebSocket.
  const paymentMutation = useMutation({
    mutationFn: (decision: PaymentDecision) => {
      if (!reservation) throw new Error('Nenhuma reserva ativa para pagar');
      return apiClient.post<Reservation>(
        '/payments',
        { reservationId: reservation.id, decision },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    },
    onSuccess: (data) => {
      setPaymentError(null);
      onReservationChange(data);
      // DECLINE libera o assento via WebSocket (seatsGateway), mas o cache
      // local pode não ter recebido o evento ainda no instante do clique —
      // invalidar garante consistência mesmo se o evento chegar atrasado.
      if (data.status === 'CANCELLED') {
        queryClient.invalidateQueries({
          queryKey: sessionSeatsKey(session.id),
        });
      }
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setPaymentError(
          'Esta reserva não está mais disponível para pagamento — pode ter expirado, sido paga ou cancelada.',
        );
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setPaymentError('Você não tem permissão para pagar esta reserva.');
        return;
      }
      setPaymentError(
        'Não foi possível processar o pagamento. Tente novamente.',
      );
    },
  });

  const selectedSeat = seats.find((seat) => seat.id === selectedSeatId);

  if (reservation) {
    const reservedSeat = seats.find((seat) => seat.id === reservation.seatId);
    const seatLabel = reservedSeat
      ? `${reservedSeat.row}${reservedSeat.number}`
      : reservation.seatId;
    const expired =
      reservation.status === 'PENDING' &&
      remainingMs !== null &&
      remainingMs <= 0;

    if (reservation.status === 'PAID') {
      return (
        <div className='rounded-lg border border-border bg-card p-4'>
          <h2 className='font-display text-lg font-semibold text-primary'>
            Pagamento aprovado
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Assento {seatLabel} — seu ingresso foi gerado.
          </p>
          <Link
            href='/my-tickets'
            className='mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline'
          >
            Ver meus ingressos
          </Link>
        </div>
      );
    }

    if (reservation.status === 'CANCELLED') {
      return (
        <div className='rounded-lg border border-border bg-card p-4'>
          <h2 className='font-display text-lg font-semibold'>
            Reserva cancelada
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            O pagamento foi recusado — o assento {seatLabel} foi liberado e já
            pode ser escolhido por outra pessoa.
          </p>
          <div className='mt-4 flex flex-wrap gap-3'>
            <Button onClick={onReset}>Escolher outro assento</Button>
            <Button variant='outline' asChild>
              <Link href='/'>Ver outras sessões</Link>
            </Button>
          </div>
        </div>
      );
    }

    if (expired) {
      return (
        <div className='rounded-lg border border-border bg-card p-4'>
          <h2 className='font-display text-lg font-semibold'>
            Reserva expirada
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            O prazo de 5 minutos para pagamento acabou e o assento {seatLabel}{' '}
            foi liberado.
          </p>
          <Button className='mt-4' onClick={onReset}>
            Escolher outro assento
          </Button>
        </div>
      );
    }

    // status PENDING, dentro do prazo — pagamento simulado (D04).
    return (
      <div className='rounded-lg border border-border bg-card p-4'>
        <h2 className='font-display text-lg font-semibold'>
          Confirme o pagamento
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Assento {seatLabel} — pendente de pagamento
        </p>
        {remainingMs !== null && (
          <p className='mt-2 font-display text-2xl font-bold text-primary'>
            {formatCountdown(remainingMs)}
          </p>
        )}
        {paymentError && (
          <p className='mt-2 text-sm text-destructive' role='alert'>
            {paymentError}
          </p>
        )}
        <div className='mt-4 flex flex-wrap gap-3'>
          <Button
            disabled={paymentMutation.isPending}
            onClick={() => paymentMutation.mutate('APPROVE')}
          >
            {paymentMutation.isPending &&
            paymentMutation.variables === 'APPROVE'
              ? 'Processando...'
              : 'Aprovar pagamento'}
          </Button>
          <Button
            variant='outline'
            disabled={paymentMutation.isPending}
            onClick={() => paymentMutation.mutate('DECLINE')}
          >
            {paymentMutation.isPending &&
            paymentMutation.variables === 'DECLINE'
              ? 'Processando...'
              : 'Recusar pagamento'}
          </Button>
        </div>
        <p className='mt-3 text-xs text-muted-foreground'>
          Pagamento simulado — a decisão é sempre explícita, nunca automática
          (D04).
        </p>
      </div>
    );
  }

  return (
    <div className='rounded-lg border border-border bg-card p-4'>
      <h2 className='font-display text-lg font-semibold'>Sua seleção</h2>
      {selectedSeat ? (
        <p className='mt-1 text-sm text-muted-foreground'>
          Assento {selectedSeat.row}
          {selectedSeat.number}
        </p>
      ) : (
        <p className='mt-1 text-sm text-muted-foreground'>
          Escolha um assento disponível no mapa.
        </p>
      )}
      {error && (
        <p className='mt-2 text-sm text-destructive' role='alert'>
          {error}
        </p>
      )}
      <Button
        className='mt-4 w-full'
        disabled={!selectedSeatId || reservationMutation.isPending}
        onClick={() => {
          if (!isAuthenticated) {
            loginRedirect();
            return;
          }
          reservationMutation.mutate();
        }}
      >
        {reservationMutation.isPending ? 'Confirmando...' : 'Confirmar reserva'}
      </Button>
    </div>
  );
}
