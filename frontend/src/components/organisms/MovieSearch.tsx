'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMovieSearch } from '@/hooks/useMovieSearch';
import {
  buildTmdbPosterUrl,
  type TmdbMovieSummary,
} from '@/types/movie-search';

interface MovieSearchProps {
  selectedMovie: TmdbMovieSummary | null;
  onSelect: (movie: TmdbMovieSummary) => void;
  onClear: () => void;
}

// Busca de filme via GET /movies/search (TMDb, D01) — passo 1 da criação de
// sessão. Filme selecionado não pode mais ser trocado sem "Trocar filme"
// (evita perder o resto do form ao digitar de novo por engano).
export function MovieSearch({
  selectedMovie,
  onSelect,
  onClear,
}: MovieSearchProps) {
  const [query, setQuery] = useState('');
  const { data: results, isFetching, isError } = useMovieSearch(query);

  if (selectedMovie) {
    const posterUrl = buildTmdbPosterUrl(selectedMovie.poster_path);
    return (
      <div className='flex items-center gap-3 rounded-lg border border-border bg-card p-3'>
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- pôster vem de host externo (TMDb), mesmo padrão de SessionCard.
          <img
            src={posterUrl}
            alt={selectedMovie.title}
            className='h-20 w-14 shrink-0 rounded object-cover'
          />
        )}
        <div className='min-w-0 flex-1'>
          <p className='truncate font-display font-semibold'>
            {selectedMovie.title}
          </p>
          {selectedMovie.release_date && (
            <p className='text-sm text-muted-foreground'>
              {selectedMovie.release_date.slice(0, 4)}
            </p>
          )}
        </div>
        <Button type='button' variant='outline' size='sm' onClick={onClear}>
          Trocar filme
        </Button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor='movie-search' className='text-sm font-medium'>
        Filme
      </label>
      <Input
        id='movie-search'
        type='search'
        autoComplete='off'
        placeholder='Buscar filme no TMDb...'
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className='mt-1'
      />
      {isFetching && (
        <p className='mt-2 text-sm text-muted-foreground'>Buscando...</p>
      )}
      {isError && (
        <p className='mt-2 text-sm text-destructive' role='alert'>
          Não foi possível buscar filmes agora.
        </p>
      )}
      {results && results.length === 0 && !isFetching && (
        <p className='mt-2 text-sm text-muted-foreground'>
          Nenhum filme encontrado.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className='mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-1'>
          {results.map((movie) => {
            const posterUrl = buildTmdbPosterUrl(movie.poster_path);
            return (
              <li key={movie.id}>
                <button
                  type='button'
                  onClick={() => onSelect(movie)}
                  className='flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground'
                >
                  {posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pôster vem de host externo (TMDb).
                    <img
                      src={posterUrl}
                      alt=''
                      className='h-14 w-10 shrink-0 rounded object-cover'
                    />
                  ) : (
                    <div className='h-14 w-10 shrink-0 rounded bg-muted' />
                  )}
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>
                      {movie.title}
                    </p>
                    {movie.release_date && (
                      <p className='text-xs text-muted-foreground'>
                        {movie.release_date.slice(0, 4)}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
