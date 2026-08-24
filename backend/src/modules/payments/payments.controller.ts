import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { processPaymentSchema } from '@cineticket/shared';
import { Reservation } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // D04: decisão (APPROVE/DECLINE) vem do cliente via botão explícito na
  // tela — nunca aleatória, nunca decidida pelo backend.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Processa pagamento simulado (aprova ou recusa a reserva)',
  })
  process(
    @Body(new ZodValidationPipe(processPaymentSchema))
    dto: ProcessPaymentDto,
    @CurrentUser() user: AuthenticatedUserRole,
  ): Promise<Reservation> {
    return this.paymentsService.process(dto, user.id);
  }
}
