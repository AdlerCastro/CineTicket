'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRequireRole } from '@/hooks/useRequireRole';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { EditSessionForm } from '@/components/organisms/EditSessionForm';

export default function EditSessionPage() {
  const status = useRequireRole('ORGANIZER');
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const { data: session, isLoading, isError } = useSession(sessionId);

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

      {isLoading && (
        <p className='mt-4 text-muted-foreground'>Carregando sessão...</p>
      )}
      {isError && (
        <p className='mt-4 text-destructive'>Sessão não encontrada.</p>
      )}

      {session && (
        <>
          <h1 className='mt-2 font-display text-3xl font-bold'>
            {session.movie.title}
          </h1>
          {/* D10: leitura é pública — um organizador consegue abrir a URL de
              edição de uma sessão de outro. Bloqueado aqui antes de mostrar o
              form (evita depender só do 403 do PATCH pra avisar o usuário). */}
          {session.organizerId !== user?.id ? (
            <p className='mt-4 text-destructive' role='alert'>
              Esta sessão pertence a outro organizador — você não pode editá-la.
            </p>
          ) : (
            <EditSessionForm session={session} />
          )}
        </>
      )}
    </div>
  );
}
