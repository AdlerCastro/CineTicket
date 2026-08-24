import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { movieSearchKey } from '@/constants/query-keys';
import type { TmdbMovieSummary } from '@/types/movie-search';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

// GET /movies/search exige JwtAuthGuard + @Roles('ORGANIZER') — chamado com
// o accessToken do organizador logado. Debounce evita uma chamada real ao
// TMDb a cada tecla digitada.
export function useMovieSearch(rawQuery: string) {
  const { accessToken } = useAuth();
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(rawQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const trimmed = debouncedQuery.trim();

  return useQuery({
    queryKey: movieSearchKey(trimmed),
    queryFn: () =>
      apiClient.get<TmdbMovieSummary[]>(
        `/movies/search?query=${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    enabled: trimmed.length >= MIN_QUERY_LENGTH && Boolean(accessToken),
  });
}
