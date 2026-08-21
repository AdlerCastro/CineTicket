// src/modules/movies/movies.service.ts
import { Injectable } from "@nestjs/common";
import { Movie, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TmdbService, TmdbMovieSummary } from "./tmdb.service";

@Injectable()
export class MoviesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbService: TmdbService,
  ) {}

  searchCatalog(query: string): Promise<TmdbMovieSummary[]> {
    return this.tmdbService.searchMovies(query);
  }

  async findOrCacheMovie(tmdbId: number): Promise<Movie> {
    const existing = await this.prisma.movie.findUnique({ where: { tmdbId } });
    if (existing) return existing;

    const details = await this.tmdbService.getMovieDetails(tmdbId);

    try {
      return await this.prisma.movie.create({
        data: {
          tmdbId: details.id,
          title: details.title,
          synopsis: details.overview,
          posterUrl: this.tmdbService.buildPosterUrl(details.poster_path),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return this.prisma.movie.findUniqueOrThrow({ where: { tmdbId } });
      }
      throw error;
    }
  }

  findAllCached() {
    return this.prisma.movie.findMany({ orderBy: { title: "asc" } });
  }
}
