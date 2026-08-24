'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireRole } from '@/hooks/useRequireRole';
import { loadLastTicketId } from '@/lib/ticket-storage';

// TAREFA 2 (Sprint 4): não existe endpoint de listagem de ingressos no
// backend (GET /tickets/mine ou equivalente) — a navegação real acontece via
// redirecionamento direto depois de um pagamento aprovado
// (/my-tickets/[ticketId], ver ReservationPanel) ou, numa visita sem esse
// redirect recente, pelo último ticketId guardado em localStorage (ver
// src/lib/ticket-storage.ts). Sem nenhum dos dois, não há como esta tela
// mostrar um ingresso — mensagem explica isso em vez de fingir uma lista.
export default function MyTicketsPage() {
  const status = useRequireRole('CUSTOMER');
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authorized') return;
    const lastTicketId = loadLastTicketId();
    if (lastTicketId) router.replace(`/my-tickets/${lastTicketId}`);
  }, [status, router]);

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  return (
    <div>
      <h1 className='font-display text-3xl font-bold'>Meus ingressos</h1>
      <p className='mt-2 text-muted-foreground'>
        Você ainda não tem um ingresso recente por aqui. Depois de aprovar um
        pagamento, o ingresso abre automaticamente nesta seção.
      </p>
    </div>
  );
}
