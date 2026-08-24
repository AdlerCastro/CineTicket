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

interface ReservationPanelProps {
  session: Session;
  seats: SeatMapItem[];
  selectedSeatId: string | null;
  reservation: Reservation | null;
  onReserved: (reservation: Reservation) => void;
  onClearSelection: () => void;
}

export function ReservationPanel({
  session,
  seats,
  selectedSeatId,
  reservation,
  onReserved,
  onClearSelection,
}: ReservationPanelProps) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const remainingMs = useCountdown(reservation?.expiresAt ?? null);

  const loginRedirect = () =>
    router.push(
      `/login?redirect=${encodeURIComponent(`/sessions/${session.id}`)}`,
    );

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<Reservation>(
        '/reservations',
        { sessionId: session.id, seatId: selectedSeatId },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    onSuccess: (data) => {
      setError(null);
      onReserved(data);
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

  const selectedSeat = seats.find((seat) => seat.id === selectedSeatId);

  if (reservation) {
    const reservedSeat = seats.find((seat) => seat.id === reservation.seatId);
    const expired = remainingMs !== null && remainingMs <= 0;

    return (
      <div className='rounded-lg border border-border bg-card p-4'>
        <h2 className='font-display text-lg font-semibold'>
          Reserva confirmada
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          Assento{' '}
          {reservedSeat
            ? `${reservedSeat.row}${reservedSeat.number}`
            : reservation.seatId}{' '}
          — {expired ? 'expirada' : 'pendente de pagamento'}
        </p>
        {!expired && remainingMs !== null && (
          <p className='mt-2 font-display text-2xl font-bold text-primary'>
            {formatCountdown(remainingMs)}
          </p>
        )}
        <p className='mt-2 text-xs text-muted-foreground'>
          Pagamento e emissão de ingresso chegam em uma etapa futura do projeto
          — este é só um indicativo visual do prazo (o backend expira a reserva
          de verdade, ver D05).
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
      {error && <p className='mt-2 text-sm text-destructive'>{error}</p>}
      <Button
        className='mt-4 w-full'
        disabled={!selectedSeatId || mutation.isPending}
        onClick={() => {
          if (!isAuthenticated) {
            loginRedirect();
            return;
          }
          mutation.mutate();
        }}
      >
        {mutation.isPending ? 'Confirmando...' : 'Confirmar reserva'}
      </Button>
    </div>
  );
}
