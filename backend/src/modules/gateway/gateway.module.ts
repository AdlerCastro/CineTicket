import { Module } from '@nestjs/common';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { SeatsGateway } from './seats.gateway';

@Module({
  imports: [SessionsModule],
  providers: [SeatsGateway],
  exports: [SeatsGateway],
})
export class GatewayModule {}
