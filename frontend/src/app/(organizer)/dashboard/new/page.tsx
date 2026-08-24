'use client';

import Link from 'next/link';
import { useRequireRole } from '@/hooks/useRequireRole';
import { CreateSessionForm } from '@/components/organisms/CreateSessionForm';

export default function NewSessionPage() {
  const status = useRequireRole('ORGANIZER');

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  return (
    <div>
      <Link
        href='/dashboard'
        className='text-sm text-muted-foreground underline-offset-4 hover:underline'
      >
        ← Minhas sessões
      </Link>
      <h1 className='mt-2 font-display text-3xl font-bold'>
        Criar nova sessão
      </h1>
      <p className='mt-2 text-muted-foreground'>
        Busque o filme no catálogo TMDb e preencha os dados da sessão.
      </p>
      <CreateSessionForm />
    </div>
  );
}
