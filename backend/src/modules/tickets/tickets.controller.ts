import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { validateTicketSchema } from '@cineticket/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { TicketsService } from './tickets.service';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import {
  TicketDisplayResponse,
  ValidateTicketResponse,
} from './dto/ticket-display.dto';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Consulta do ingresso pelo dono (D46: QR renderizado client-side a
  // partir do `jwt` retornado aqui — backend nunca gera imagem de QR).
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consulta ingresso próprio (JWT + dados de exibição)',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUserRole,
  ): Promise<TicketDisplayResponse> {
    return this.ticketsService.findByIdForCustomer(id, user.id);
  }

  // Validação de portaria: mesma string de entrada seja lida por câmera ou
  // digitada manualmente no frontend — sem distinção aqui. 200 (não 201,
  // default de POST no Nest) porque nenhum recurso novo é criado — é uma
  // checagem de estado sobre o Ticket já existente.
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GATE')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Valida ingresso na portaria (VALIDO | INVALIDO | JA_USADO | EVENTO_ERRADO)',
  })
  validate(
    @Body(new ZodValidationPipe(validateTicketSchema))
    dto: ValidateTicketDto,
  ): Promise<ValidateTicketResponse> {
    return this.ticketsService.validate(dto);
  }
}
