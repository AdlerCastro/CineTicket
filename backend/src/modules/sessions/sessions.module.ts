import { Module } from '@nestjs/common';
import { MoviesModule } from '@/modules/movies/movies.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [MoviesModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
