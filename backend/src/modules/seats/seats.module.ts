import { Module } from '@nestjs/common';
import { ReservationsModule } from '@/modules/reservations/reservations.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { SeatsController } from './seats.controller';
import { SeatsService } from './seats.service';

@Module({
  imports: [ReservationsModule, SessionsModule],
  controllers: [SeatsController],
  providers: [SeatsService],
})
export class SeatsModule {}
