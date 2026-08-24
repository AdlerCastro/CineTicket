import { Module } from '@nestjs/common';
import { ReservationsModule } from '@/modules/reservations/reservations.module';
import { TicketsModule } from '@/modules/tickets/tickets.module';
import { GatewayModule } from '@/modules/gateway/gateway.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [ReservationsModule, TicketsModule, GatewayModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
