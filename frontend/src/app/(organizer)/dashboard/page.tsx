'use client';

import Link from 'next/link';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useMySessions } from '@/hooks/useMySessions';
import { OrganizerSessionCard } from '@/components/organisms/OrganizerSessionCard';
import { Button } from '@/components/ui/button';

export default function OrganizerDashboardPage() {
  const status = useRequireRole('ORGANIZER');
  const { sessions, isLoading, isError } = useMySessions();

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  return (
    <div>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='font-display text-3xl font-bold'>
            Painel do organizador
          </h1>
          <p className='mt-2 text-muted-foreground'>
            Minhas sessões — criação, edição e publicação.
          </p>
        </div>
        <Button asChild>
          <Link href='/dashboard/new'>Criar sessão</Link>
        </Button>
      </div>

      {isLoading && (
        <p className='mt-8 text-muted-foreground'>Carregando sessões...</p>
      )}
      {isError && (
        <p className='mt-8 text-destructive'>
          Não foi possível carregar suas sessões.
        </p>
      )}
      {!isLoading && !isError && sessions.length === 0 && (
        <p className='mt-8 text-muted-foreground'>
          Você ainda não criou nenhuma sessão.
        </p>
      )}

      <div className='mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {sessions.map((session) => (
          <OrganizerSessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
