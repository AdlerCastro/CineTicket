'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import { createSessionSchema } from '@cineticket/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MovieSearch } from '@/components/organisms/MovieSearch';
import { useCreateSession } from '@/hooks/useCreateSession';
import { ApiError } from '@/lib/api-client';
import type { TmdbMovieSummary } from '@/types/movie-search';

// `startsAt` usa z.coerce.date(): tipo de ENTRADA (o que o <input> escreve) é
// `unknown`/string, o de SAÍDA (o que chega no onSubmit após o zodResolver
// rodar o parse) é `Date` de verdade — ver mesmo padrão em EditSessionForm.
type CreateSessionFormInput = z.input<typeof createSessionSchema>;
type CreateSessionFormOutput = z.output<typeof createSessionSchema>;

export function CreateSessionForm() {
  const router = useRouter();
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieSummary | null>(
    null,
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const createSession = useCreateSession();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateSessionFormInput, unknown, CreateSessionFormOutput>({
    resolver: zodResolver(createSessionSchema),
  });

  const handleSelectMovie = (movie: TmdbMovieSummary) => {
    setSelectedMovie(movie);
    setValue('tmdbId', movie.id, { shouldValidate: true });
  };

  const onSubmit = (data: CreateSessionFormOutput) => {
    setServerError(null);
    createSession.mutate(data, {
      onSuccess: (created) => {
        router.push(`/dashboard/${created.id}`);
      },
      onError: (error: unknown) => {
        setServerError(
          error instanceof ApiError
            ? 'Não foi possível criar a sessão. Confira os dados e tente novamente.'
            : 'Não foi possível criar a sessão. Tente novamente.',
        );
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='mt-6 max-w-lg space-y-5'>
      <div>
        <MovieSearch
          selectedMovie={selectedMovie}
          onSelect={handleSelectMovie}
          onClear={() => {
            setSelectedMovie(null);
            // tmdbId é number obrigatório no schema (sem .optional()) — não
            // há um "undefined" válido nesse tipo; o cast só existe pra
            // voltar o campo pro estado "nunca preenchido" na UI, a
            // validação real do zod continua exigindo positive() no submit.
            setValue('tmdbId', undefined as unknown as number);
          }}
        />
        {errors.tmdbId && (
          <p className='mt-1 text-xs text-destructive' role='alert'>
            Selecione um filme antes de continuar.
          </p>
        )}
      </div>

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

      <div className='grid grid-cols-2 gap-4'>
        <div>
          <label htmlFor='capacity' className='text-sm font-medium'>
            Capacidade
          </label>
          <Input
            id='capacity'
            type='number'
            min={1}
            step={1}
            className='mt-1'
            {...register('capacity', { valueAsNumber: true })}
          />
          {errors.capacity && (
            <p className='mt-1 text-xs text-destructive' role='alert'>
              Informe a capacidade de assentos.
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
      </div>

      <p className='text-xs text-muted-foreground'>
        A sessão nasce como <strong>rascunho</strong> (não publicada) — ela só
        aparece pro público e fica reservável depois que você publicar
        explicitamente na tela seguinte.
      </p>

      {serverError && (
        <p className='text-sm text-destructive' role='alert'>
          {serverError}
        </p>
      )}

      <Button type='submit' disabled={createSession.isPending}>
        {createSession.isPending ? 'Criando...' : 'Criar sessão'}
      </Button>
    </form>
  );
}
