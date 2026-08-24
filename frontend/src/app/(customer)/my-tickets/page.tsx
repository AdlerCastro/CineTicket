'use client';

import Link from 'next/link';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useMyTickets } from '@/hooks/useMyTickets';
import { formatSessionDateTime } from '@/lib/utils';
import { TicketStatus } from '@/enums/ticket-status.enum';

// D53: listagem real via GET /tickets/mine, substituindo o fallback de
// Sprint 4 que só cobria "último ingresso pago nesta sessão de navegador"
// (localStorage, ver src/lib/ticket-storage.ts — continua em uso pelo
// ReservationPanel/detalhe do ticket, só não é mais a fonte desta tela).
const STATUS_META: Record<TicketStatus, { label: string; className: string }> =
  {
    [TicketStatus.VALID]: {
      label: 'Válido',
      className: 'border-primary bg-primary/10 text-primary',
    },
    [TicketStatus.USED]: {
      label: 'Utilizado',
      className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
    },
  };

export default function MyTicketsPage() {
  const status = useRequireRole('CUSTOMER');
  const { data: tickets, isLoading, isError } = useMyTickets();

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  return (
    <div>
      <h1 className='font-display text-3xl font-bold'>Meus ingressos</h1>

      {isLoading && (
        <p className='mt-6 text-muted-foreground'>Carregando ingressos...</p>
      )}

      {isError && (
        <p className='mt-6 text-destructive' role='alert'>
          Não foi possível carregar seus ingressos. Tente novamente.
        </p>
      )}

      {!isLoading && !isError && tickets?.length === 0 && (
        <p className='mt-6 text-muted-foreground'>
          Você ainda não tem nenhum ingresso. Reserve um assento em uma sessão
          em cartaz para ver seu ingresso aqui.
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <ul className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {tickets.map((ticket) => {
            const statusMeta = STATUS_META[ticket.status];
            return (
              <li key={ticket.id}>
                <Link
                  href={`/my-tickets/${ticket.id}`}
                  className='flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary'
                >
                  {ticket.session.movie.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- pôster vem de host externo (TMDb), mesmo padrão de OrganizerSessionCard.
                    <img
                      src={ticket.session.movie.posterUrl}
                      alt={ticket.session.movie.title}
                      className='h-24 w-16 shrink-0 rounded object-cover'
                    />
                  )}
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-start justify-between gap-2'>
                      <h2 className='truncate font-display text-lg font-semibold'>
                        {ticket.session.movie.title}
                      </h2>
                      <span
                        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      Sala {ticket.session.room} —{' '}
                      {formatSessionDateTime(ticket.session.startsAt)}
                    </p>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      Assento {ticket.seat.row}
                      {ticket.seat.number}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
