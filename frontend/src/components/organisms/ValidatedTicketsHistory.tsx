'use client';

import { CheckCircle2 } from 'lucide-react';
import { useValidatedTickets } from '@/hooks/useValidatedTickets';
import { formatSessionDateTime } from '@/lib/utils';

interface ValidatedTicketsHistoryProps {
  sessionId: string;
}

// D56: histórico dos ingressos já validados na sessão selecionada — dado
// real do backend (GET /tickets/validated), não lista mantida só em memória
// do navegador (rejeitado em D56 por não sobreviver a reload/logout).
// Atualiza ao trocar de sessão e por polling curto ao validar um novo
// ingresso — ver useValidatedTickets.ts.
export function ValidatedTicketsHistory({
  sessionId,
}: ValidatedTicketsHistoryProps) {
  const { data: tickets, isLoading, isError } = useValidatedTickets(sessionId);

  return (
    <section className='mt-8'>
      <h2 className='font-display text-lg font-semibold'>
        Histórico de validações
      </h2>

      {isLoading && (
        <p className='mt-2 text-sm text-muted-foreground'>
          Carregando histórico...
        </p>
      )}

      {isError && (
        <p className='mt-2 text-sm text-destructive' role='alert'>
          Não foi possível carregar o histórico de validações.
        </p>
      )}

      {tickets && tickets.length === 0 && (
        <p className='mt-2 text-sm text-muted-foreground'>
          Nenhum ingresso validado ainda nesta sessão.
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <ul className='mt-2 divide-y divide-border rounded-lg border border-border'>
          {tickets.map((ticket) => (
            <li
              key={ticket.id}
              className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3 text-sm'
            >
              <span className='flex min-w-0 items-center gap-2 font-medium'>
                <CheckCircle2
                  className='h-4 w-4 shrink-0 text-green-600 dark:text-green-400'
                  aria-hidden='true'
                />
                <span className='truncate'>
                  Assento {ticket.seat.row}
                  {ticket.seat.number}
                </span>
              </span>
              <span className='shrink-0 text-muted-foreground'>
                {formatSessionDateTime(ticket.usedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
