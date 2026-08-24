// Espelha TmdbMovieSummary de backend/src/modules/movies/tmdb.service.ts —
// resultado cru de GET /movies/search (TMDb), diferente de types/session.ts#Movie
// (que é o Movie já cacheado no Prisma, com id/tmdbId separados).
export interface TmdbMovieSummary {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
}

export function buildTmdbPosterUrl(posterPath: string | null): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
}
