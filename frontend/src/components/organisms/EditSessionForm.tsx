'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { updateSessionSchema } from '@cineticket/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpdateSession } from '@/hooks/useUpdateSession';
import { ApiError } from '@/lib/api-client';
import { toDatetimeLocalValue } from '@/lib/utils';
import type { Session } from '@/types/session';

// updateSessionSchema (packages/shared) deliberadamente não aceita
// tmdbId/capacity — mudar depois quebraria a correspondência Session<->Seat[]
// já gerada na criação. Campo explícito na UI em vez de omissão silenciosa.
const editableFieldsSchema = updateSessionSchema.pick({
  room: true,
  startsAt: true,
  price: true,
});
// `startsAt` usa z.coerce.date(): o tipo de ENTRADA (o que o <input> escreve,
// via defaultValues/register) é `unknown`/string, o de SAÍDA (o que chega no
// onSubmit depois do zodResolver rodar o parse) é `Date` de verdade — RHF 7.43+
// suporta os dois tipos separados via o 3º genérico de useForm.
type EditableFieldsInput = z.input<typeof editableFieldsSchema>;
type EditableFieldsOutput = z.output<typeof editableFieldsSchema>;

interface EditSessionFormProps {
  session: Session;
}

export function EditSessionForm({ session }: EditSessionFormProps) {
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [fieldsSuccess, setFieldsSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const updateSession = useUpdateSession(session.id);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditableFieldsInput, unknown, EditableFieldsOutput>({
    resolver: zodResolver(editableFieldsSchema),
    defaultValues: {
      room: session.room,
      // zod tipa ZodDate.input como `Date` mesmo com `coerce: true` (só
      // string/number/boolean ganham input `unknown` no coerce — limitação
      // conhecida do zod 3, não um erro deste form) — em runtime o
      // resolver aceita a string do <input type="datetime-local"> normalmente.
      startsAt: toDatetimeLocalValue(session.startsAt) as unknown as Date,
      price: Number(session.price),
    },
  });

  const onSubmitFields = (data: EditableFieldsOutput) => {
    setFieldsError(null);
    setFieldsSuccess(false);
    updateSession.mutate(data, {
      onSuccess: () => setFieldsSuccess(true),
      onError: (error: unknown) => {
        setFieldsError(
          error instanceof ApiError && error.status === 403
            ? 'Você não tem permissão para editar esta sessão — ela pertence a outro organizador.'
            : 'Não foi possível salvar as alterações. Tente novamente.',
        );
      },
    });
  };

  const togglePublished = () => {
    setPublishError(null);
    updateSession.mutate(
      { published: !session.published },
      {
        onError: (error: unknown) => {
          setPublishError(
            error instanceof ApiError && error.status === 403
              ? 'Você não tem permissão para publicar esta sessão — ela pertence a outro organizador.'
              : 'Não foi possível atualizar a publicação. Tente novamente.',
          );
        },
      },
    );
  };

  const isPublishPending =
    updateSession.isPending &&
    typeof updateSession.variables === 'object' &&
    updateSession.variables !== null &&
    'published' in updateSession.variables;
  const isFieldsPending = updateSession.isPending && !isPublishPending;

  return (
    <div className='mt-6 max-w-lg space-y-6'>
      <div className='rounded-lg border border-border bg-card p-4'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <p className='text-sm font-medium'>
              Status:{' '}
              <span
                className={
                  session.published ? 'text-primary' : 'text-muted-foreground'
                }
              >
                {session.published ? 'Publicada' : 'Rascunho'}
              </span>
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {session.published
                ? 'Visível no catálogo, com mapa de assentos reservável e WebSocket ativo para esta sessão.'
                : 'Não aparece no catálogo público, o mapa de assentos não pode ser reservado e o WebSocket recusa inscrição nesta sessão (D40).'}
            </p>
          </div>
          <Button
            type='button'
            variant={session.published ? 'outline' : 'default'}
            disabled={updateSession.isPending}
            onClick={togglePublished}
          >
            {isPublishPending
              ? 'Atualizando...'
              : session.published
                ? 'Despublicar sessão'
                : 'Publicar sessão'}
          </Button>
        </div>
        {publishError && (
          <p className='mt-2 text-sm text-destructive' role='alert'>
            {publishError}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmitFields)}
        className='space-y-4 rounded-lg border border-border bg-card p-4'
      >
        <h2 className='font-display text-lg font-semibold'>Editar detalhes</h2>
        <p className='text-xs text-muted-foreground'>
          Filme ({session.movie.title}) e capacidade ({session.capacity}{' '}
          assentos) não podem ser alterados depois da criação.
        </p>

        <div>
          <label htmlFor='room' className='text-sm font-medium'>
            Sala
          </label>
          <Input id='room' className='mt-1' {...register('room')} />
          {errors.room && (
            <p className='mt-1 text-xs text-destructive' role='alert'>
              {errors.room.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor='startsAt' className='text-sm font-medium'>
            Data e horário
          </label>
          <Input
            id='startsAt'
            type='datetime-local'
            className='mt-1'
            {...register('startsAt')}
          />
          {errors.startsAt && (
            <p className='mt-1 text-xs text-destructive' role='alert'>
              Informe uma data e horário válidos.
            </p>
          )}
        </div>

        <div>
          <label htmlFor='price' className='text-sm font-medium'>
            Preço (R$)
          </label>
          <Input
            id='price'
            type='number'
            min={0}
            step={0.01}
            className='mt-1'
            {...register('price', { valueAsNumber: true })}
          />
          {errors.price && (
            <p className='mt-1 text-xs text-destructive' role='alert'>
              Informe um preço válido.
            </p>
          )}
        </div>

        {fieldsError && (
          <p className='text-sm text-destructive' role='alert'>
            {fieldsError}
          </p>
        )}
        {fieldsSuccess && !fieldsError && (
          <p className='text-sm text-primary' role='status'>
            Alterações salvas.
          </p>
        )}

        <Button type='submit' disabled={updateSession.isPending}>
          {isFieldsPending ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>
    </div>
  );
}
