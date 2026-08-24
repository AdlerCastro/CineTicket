'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// D52: único ponto do grupo (customer) onde "voltar" clarifica de verdade —
// /my-tickets/[ticketId] é chegado por um link a partir da listagem
// (/my-tickets), mas não tinha volta explícita nenhuma antes desta tarefa.
const TICKET_DETAIL_PATTERN = /^\/my-tickets\/[^/]+$/;

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showBackToTickets = TICKET_DETAIL_PATTERN.test(pathname);

  return (
    <div className='container py-8'>
      {showBackToTickets && (
        <Link
          href='/my-tickets'
          className='mb-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline'
        >
          ← Meus ingressos
        </Link>
      )}
      {children}
    </div>
  );
}
