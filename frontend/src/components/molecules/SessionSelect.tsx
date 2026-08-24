'use client';

import { useSessions } from '@/hooks/useSessions';
import { cn, formatSessionDateTime } from '@/lib/utils';

interface SessionSelectProps {
  value: string | null;
  onChange: (sessionId: string) => void;
}

// `<select>` nativo em vez de um componente de Select customizado: navegação
// por teclado e leitor de tela funcionam de graça, e o projeto não tem
// Radix Select instalado (D46 só trouxe qrcode.react/qr-scanner) — adicionar
// uma dependência nova só para isso seria fora de escopo desta tarefa.
export function SessionSelect({ value, onChange }: SessionSelectProps) {
  const { data: sessions, isLoading, isError } = useSessions();

  return (
    <div>
      <label htmlFor='gate-session-select' className='text-sm font-medium'>
        Sessão sendo validada nesta portaria
      </label>
      <select
        id='gate-session-select'
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        )}
      >
        <option value='' disabled>
          {isLoading ? 'Carregando sessões...' : 'Selecione a sessão'}
        </option>
        {sessions?.map((session) => (
          <option key={session.id} value={session.id}>
            {session.movie.title} — Sala {session.room} —{' '}
            {formatSessionDateTime(session.startsAt)}
          </option>
        ))}
      </select>
      {isError && (
        <p className='mt-1 text-xs text-destructive' role='alert'>
          Não foi possível carregar as sessões.
        </p>
      )}
    </div>
  );
}
