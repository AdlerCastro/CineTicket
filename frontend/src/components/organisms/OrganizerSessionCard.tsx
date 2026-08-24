import Link from 'next/link';
import { formatPrice, formatSessionDateTime } from '@/lib/utils';
import type { Session } from '@/types/session';

interface OrganizerSessionCardProps {
  session: Session;
}

// Versão de SessionCard para o painel do organizador — mesma identidade
// visual, mas o status (rascunho/publicada) é o dado mais importante aqui
// (não um badge secundário) e o card inteiro leva pra tela de edição, não
// pro detalhe público de reserva.
export function OrganizerSessionCard({ session }: OrganizerSessionCardProps) {
  return (
    <Link
      href={`/dashboard/${session.id}`}
      className='flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary'
    >
      {session.movie.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- pôster vem de host externo (TMDb), mesmo padrão de SessionCard.
        <img
          src={session.movie.posterUrl}
          alt={session.movie.title}
          className='h-24 w-16 shrink-0 rounded object-cover'
        />
      )}
      <div className='min-w-0 flex-1'>
        <div className='flex items-start justify-between gap-2'>
          <h2 className='truncate font-display text-lg font-semibold'>
            {session.movie.title}
          </h2>
          <span
            className={
              session.published
                ? 'whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                : 'whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground'
            }
          >
            {session.published ? 'Publicada' : 'Rascunho'}
          </span>
        </div>
        <p className='mt-1 text-sm text-muted-foreground'>
          Sala {session.room} — {formatSessionDateTime(session.startsAt)}
        </p>
        <div className='mt-3 flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>
            {session.capacity} assentos
          </span>
          <span className='font-medium text-primary'>
            {formatPrice(session.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
