'use client';

import { useState } from 'react';
import { useRequireRole } from '@/hooks/useRequireRole';
import { SessionSelect } from '@/components/molecules/SessionSelect';
import { GateScanner } from '@/components/organisms/GateScanner';
import { ValidatedTicketsHistory } from '@/components/organisms/ValidatedTicketsHistory';

export default function GateCheckInPage() {
  const status = useRequireRole('GATE');
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (status !== 'authorized') {
    return <p className='text-muted-foreground'>Verificando acesso...</p>;
  }

  return (
    <div>
      <h1 className='font-display text-3xl font-bold'>Portaria</h1>
      <p className='mt-2 text-muted-foreground'>
        Selecione a sessão sendo validada e escaneie o QR do ingresso — ou
        digite o código manualmente.
      </p>

      <div className='mt-6 max-w-sm'>
        <SessionSelect value={sessionId} onChange={setSessionId} />
      </div>

      {sessionId ? (
        <>
          <GateScanner sessionId={sessionId} />
          <ValidatedTicketsHistory sessionId={sessionId} />
        </>
      ) : (
        <p className='mt-6 text-sm text-muted-foreground'>
          Selecione uma sessão para habilitar a câmera e o campo manual.
        </p>
      )}
    </div>
  );
}
