import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { TmdbMovieSummary } from './tmdb.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  search(@Query('query') query: string): Promise<TmdbMovieSummary[]> {
    return this.moviesService.searchCatalog(query);
  }
}
