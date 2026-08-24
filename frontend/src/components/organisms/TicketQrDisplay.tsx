import { QRCodeSVG } from 'qrcode.react';
import { formatSessionDateTime } from '@/lib/utils';
import { TicketStatus } from '@/enums/ticket-status.enum';
import type { TicketDisplay } from '@/types/ticket';

const STATUS_META: Record<TicketStatus, { label: string; className: string }> =
  {
    [TicketStatus.VALID]: {
      label: 'Válido',
      className: 'border-primary bg-primary/10 text-primary',
    },
    [TicketStatus.USED]: {
      label: 'Utilizado',
      className: 'border-muted-foreground/40 bg-muted text-muted-foreground',
    },
  };

interface TicketQrDisplayProps {
  ticket: TicketDisplay;
}

// TAREFA 2 (Sprint 4): QR renderizado 100% client-side a partir do JWT
// (`ticket.jwt`) via qrcode.react — nenhuma imagem de QR é gerada no
// backend (D46). Cores do QR fixas em preto/branco (não os tokens do tema)
// de propósito: um leitor de câmera precisa de contraste real pra decodificar
// de forma confiável, independente do dark mode estar ativo.
export function TicketQrDisplay({ ticket }: TicketQrDisplayProps) {
  const status = STATUS_META[ticket.status];

  return (
    <div className='mx-auto max-w-sm rounded-lg border border-border bg-card p-6'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h1 className='font-display text-2xl font-bold'>
            {ticket.session.movie.title}
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Sala {ticket.session.room} —{' '}
            {formatSessionDateTime(ticket.session.startsAt)}
          </p>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className='mt-6 flex justify-center rounded-md bg-white p-4'>
        <QRCodeSVG
          value={ticket.jwt}
          size={200}
          bgColor='#FFFFFF'
          fgColor='#000000'
          marginSize={2}
          level='M'
          title={`QR do ingresso — assento ${ticket.seat.row}${ticket.seat.number}`}
        />
      </div>

      <dl className='mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
        <dt className='font-medium text-muted-foreground'>Assento</dt>
        <dd>
          {ticket.seat.row}
          {ticket.seat.number}
        </dd>
        {ticket.usedAt && (
          <>
            <dt className='font-medium text-muted-foreground'>Utilizado em</dt>
            <dd>{formatSessionDateTime(ticket.usedAt)}</dd>
          </>
        )}
      </dl>

      <p className='mt-6 text-center text-xs text-muted-foreground'>
        Apresente este QR na portaria. Ele não expira por tempo — deixa de
        funcionar assim que for utilizado.
      </p>
    </div>
  );
}
