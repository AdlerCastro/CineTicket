import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TmdbService } from "./tmdb.service";
import { MoviesService } from "./movies.service";
import { MoviesController } from "./movies.controller";

@Module({
  imports: [HttpModule],
  controllers: [MoviesController],
  providers: [TmdbService, MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
