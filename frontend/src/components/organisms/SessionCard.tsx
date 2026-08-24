import Link from 'next/link';
import { formatPrice, formatSessionDateTime } from '@/lib/utils';
import type { Session } from '@/types/session';

export function SessionCard({ session }: { session: Session }) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className='block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary'
    >
      <div className='flex items-start justify-between gap-2'>
        <h2 className='font-display text-lg font-semibold'>
          Sala {session.room}
        </h2>
        {/* D40: GET /sessions não filtra published — rascunho aparece aqui,
            sinalizado visualmente em vez de escondido silenciosamente. */}
        {!session.published && (
          <span className='whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground'>
            Rascunho
          </span>
        )}
      </div>
      <p className='mt-1 text-sm text-muted-foreground'>
        {formatSessionDateTime(session.startsAt)}
      </p>
      <div className='mt-3 flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>
          {session.capacity} assentos
        </span>
        <span className='font-medium text-primary'>
          {formatPrice(session.price)}
        </span>
      </div>
    </Link>
  );
}
