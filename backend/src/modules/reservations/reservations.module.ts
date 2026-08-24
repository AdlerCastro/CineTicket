import { Module } from '@nestjs/common';
import { GatewayModule } from '@/modules/gateway/gateway.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [GatewayModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
