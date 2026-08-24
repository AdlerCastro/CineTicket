import { CheckCircle2, XCircle, History, MapPinOff } from 'lucide-react';
import { cn, formatSessionDateTime } from '@/lib/utils';
import { TicketValidationResult } from '@/enums/ticket-validation-result.enum';
import type { TicketValidationOutcome } from '@/hooks/useTicketValidation';

const RESULT_META: Record<
  TicketValidationResult,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  [TicketValidationResult.VALIDO]: {
    label: 'VÁLIDO',
    icon: CheckCircle2,
    className:
      'border-green-600 bg-green-600/10 text-green-700 dark:border-green-500 dark:text-green-400',
  },
  [TicketValidationResult.INVALIDO]: {
    label: 'INVÁLIDO',
    icon: XCircle,
    className: 'border-destructive bg-destructive/10 text-destructive',
  },
  [TicketValidationResult.JA_USADO]: {
    label: 'JÁ USADO',
    icon: History,
    // Não usa os tokens accent/accent-foreground do tema aqui: foram
    // desenhados pra texto EM CIMA de um preenchimento sólido de accent, não
    // pra texto sobre um tint translúcido de 10% — combinados ficavam quase
    // ilegíveis no dark mode (achado durante teste real em navegador).
    className:
      'border-amber-600 bg-amber-600/10 text-amber-700 dark:border-amber-400 dark:text-amber-400',
  },
  [TicketValidationResult.EVENTO_ERRADO]: {
    label: 'EVENTO ERRADO',
    icon: MapPinOff,
    className:
      'border-blue-600 bg-blue-600/10 text-blue-700 dark:border-blue-500 dark:text-blue-400',
  },
};

interface TicketValidationBannerProps {
  outcome: TicketValidationOutcome;
}

// Resultado exibido com cor + ícone distintos por estado, não só texto — a
// tela é usada rapidamente por um funcionário em pé numa fila (TAREFA 3).
// aria-live: leitor de tela anuncia o resultado assim que ele chega, sem
// precisar de foco manual.
export function TicketValidationBanner({
  outcome,
}: TicketValidationBannerProps) {
  const meta = RESULT_META[outcome.result];
  const Icon = meta.icon;

  return (
    <div
      role='status'
      aria-live='polite'
      className={cn('rounded-lg border-2 p-4', meta.className)}
    >
      <div className='flex items-center gap-3'>
        <Icon className='h-8 w-8 shrink-0' aria-hidden='true' />
        <div>
          <p className='font-display text-xl font-bold'>{meta.label}</p>
          <p className='text-sm'>{outcome.message}</p>
        </div>
      </div>
      {outcome.ticket && (
        <dl className='border-current/20 mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-sm'>
          <dt className='font-medium'>Filme</dt>
          <dd>{outcome.ticket.session.movie.title}</dd>
          <dt className='font-medium'>Sala</dt>
          <dd>{outcome.ticket.session.room}</dd>
          <dt className='font-medium'>Sessão</dt>
          <dd>{formatSessionDateTime(outcome.ticket.session.startsAt)}</dd>
          <dt className='font-medium'>Assento</dt>
          <dd>
            {outcome.ticket.seat.row}
            {outcome.ticket.seat.number}
          </dd>
        </dl>
      )}
    </div>
  );
}
