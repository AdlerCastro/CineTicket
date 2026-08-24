'use client';

import { useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGateCameraScanner } from '@/hooks/useGateCameraScanner';
import { useTicketValidation } from '@/hooks/useTicketValidation';
import { TicketValidationBanner } from '@/components/molecules/TicketValidationBanner';
import {
  manualTicketTokenSchema,
  type ManualTicketTokenInput,
} from '@/lib/gate-validation-form';

// Ignora re-scans do MESMO QR ainda visível no quadro da câmera — sem isso o
// decoder dispara várias vezes por segundo e cada uma viraria uma chamada
// real a POST /tickets/validate (a segunda já voltaria JA_USADO mesmo sendo
// só a câmera "vendo o mesmo código de novo", não uma segunda tentativa
// real). Não se aplica ao campo manual (submit é sempre uma ação explícita).
const RESCAN_DEBOUNCE_MS = 3000;

const CAMERA_STATUS_LABEL: Record<string, string> = {
  idle: 'Selecione a sessão acima para ativar a câmera.',
  starting: 'Iniciando câmera...',
  active: 'Aponte a câmera para o QR code do ingresso.',
  error:
    'Não foi possível acessar a câmera — verifique a permissão do navegador (câmera exige HTTPS, exceto em localhost).',
  unsupported:
    'Nenhuma câmera disponível neste dispositivo — use o campo manual abaixo.',
};

interface GateScannerProps {
  sessionId: string;
}

export function GateScanner({ sessionId }: GateScannerProps) {
  const validation = useTicketValidation(sessionId);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);

  const handleDecode = useCallback((token: string) => {
    const now = Date.now();
    const last = lastScanRef.current;
    if (last && last.token === token && now - last.at < RESCAN_DEBOUNCE_MS) {
      return;
    }
    lastScanRef.current = { token, at: now };
    validation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validation.mutate é estável (react-query), reincluir validation completo re-criaria a câmera a cada mutation
  }, []);

  const { videoRef, status: cameraStatus } = useGateCameraScanner({
    enabled: Boolean(sessionId),
    onDecode: handleDecode,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualTicketTokenInput>({
    resolver: zodResolver(manualTicketTokenSchema),
  });

  const onManualSubmit = (data: ManualTicketTokenInput) => {
    lastScanRef.current = { token: data.token, at: Date.now() };
    validation.mutate(data.token, { onSuccess: () => reset() });
  };

  return (
    <div className='mt-6'>
      <div className='grid gap-6 md:grid-cols-2'>
        <div>
          <h2 className='font-display text-lg font-semibold'>Câmera</h2>
          <div className='mt-2 aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted'>
            <video
              ref={videoRef}
              muted
              playsInline
              className='h-full w-full object-cover'
              aria-label='Câmera de leitura de QR code do ingresso'
            />
          </div>
          <p className='mt-2 text-xs text-muted-foreground' role='status'>
            {CAMERA_STATUS_LABEL[cameraStatus]}
          </p>
        </div>

        <div>
          <h2 className='font-display text-lg font-semibold'>Código manual</h2>
          <form
            onSubmit={handleSubmit(onManualSubmit)}
            className='mt-2 space-y-2'
          >
            <label htmlFor='manual-token' className='block text-sm'>
              Cole ou digite o código do ingresso — use se a câmera falhar ou o
              ingresso for compartilhado por texto.
            </label>
            <Input
              id='manual-token'
              autoComplete='off'
              placeholder='Código do ingresso (JWT)'
              {...register('token')}
            />
            {errors.token && (
              <p className='text-xs text-destructive' role='alert'>
                {errors.token.message}
              </p>
            )}
            <Button
              type='submit'
              className='w-full'
              disabled={validation.isPending}
            >
              {validation.isPending ? 'Validando...' : 'Validar ingresso'}
            </Button>
          </form>
        </div>
      </div>

      <div className='mt-6'>
        {validation.data && (
          <TicketValidationBanner outcome={validation.data} />
        )}
        {validation.isError && (
          <p className='text-sm text-destructive' role='alert'>
            Não foi possível validar o ingresso. Tente novamente.
          </p>
        )}
      </div>
    </div>
  );
}
