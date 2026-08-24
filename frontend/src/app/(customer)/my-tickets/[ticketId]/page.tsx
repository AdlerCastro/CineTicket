'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useTicket } from '@/hooks/useTicket';
import { TicketQrDisplay } from '@/components/organisms/TicketQrDisplay';
import { saveLastTicketId } from '@/lib/ticket-storage';
import { ApiError } from '@/lib/api-client';

export default function TicketDetailPage() {
  const status = useRequireRole('CUSTOMER');
  const params = useParams<{ ticketId: string }>();
  const ticketId = params.ticketId;

  const {
    data: ticket,
    isLoading,
    isError,
    error,
  } = useTicket(status === 'authorized' ? ticketId : '');

  // Guarda o último ticket visto — permite `/my-tickets` (sem id) levar de
  // volta pra cá numa visita futura, já que não existe endpoint de listagem
  // (ver .context/project-state.md).
  useEffect(() => {
    if (ticket) saveLastTicketId(ticket.id);
  }, [ticket]);

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  if (isLoading) {
    return <p className='text-muted-foreground'>Carregando ingresso...</p>;
  }

  if (isError) {
    const forbidden = error instanceof ApiError && error.status === 403;
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <p className='text-destructive' role='alert'>
        {forbidden
          ? 'Este ingresso não pertence à sua conta.'
          : notFound
            ? 'Ingresso não encontrado.'
            : 'Não foi possível carregar o ingresso. Tente novamente.'}
      </p>
    );
  }

  if (!ticket) return null;

  return (
    <div>
      <h1 className='sr-only'>Ingresso</h1>
      <TicketQrDisplay ticket={ticket} />
    </div>
  );
}
