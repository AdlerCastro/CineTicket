import { Module } from '@nestjs/common';
import { ReservationsModule } from '@/modules/reservations/reservations.module';
import { SeatsController } from './seats.controller';
import { SeatsService } from './seats.service';

@Module({
  imports: [ReservationsModule],
  controllers: [SeatsController],
  providers: [SeatsService],
})
export class SeatsModule {}
