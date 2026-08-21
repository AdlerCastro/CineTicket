import { AppConfigService } from "@/config/config.service";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { catchError, firstValueFrom } from "rxjs";
import { AxiosError } from "axios";

export interface TmdbMovieSummary {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
}

interface TmdbSearchResponse {
  results: TmdbMovieSummary[];
}

export interface TmdbMovieDetails extends TmdbMovieSummary {
  runtime: number;
  genres: { id: number; name: string }[];
}

@Injectable()
export class TmdbService {
  private readonly baseUrl = "https://api.themoviedb.org/3";

  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  async searchMovies(query: string): Promise<TmdbMovieSummary[]> {
    const { data } = await firstValueFrom(
      this.http
        .get<TmdbSearchResponse>(`${this.baseUrl}/search/movie`, {
          params: { query, language: "pt-BR" },
          headers: { Authorization: `Bearer ${this.config.tmdbApiKey}` },
        })
        .pipe(
          catchError((error: AxiosError) => {
            throw new ServiceUnavailableException(
              `Falha ao consultar a API do TMDB: ${error.message}`,
            );
          }),
        ),
    );
    return data.results;
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const { data } = await firstValueFrom(
      this.http
        .get<TmdbMovieDetails>(`${this.baseUrl}/movie/${tmdbId}`, {
          params: { language: "pt-BR" },
          headers: { Authorization: `Bearer ${this.config.tmdbApiKey}` },
        })
        .pipe(
          catchError((error: AxiosError) => {
            throw new ServiceUnavailableException(
              `Falha ao buscar detalhes do filme ${tmdbId}: ${error.message}`,
            );
          }),
        ),
    );
    return data;
  }

  buildPosterUrl(posterPath: string | null): string | null {
    return posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
  }
}
