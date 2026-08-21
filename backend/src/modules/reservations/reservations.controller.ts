import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReservationSchema } from '@cineticket/shared';
import { Reservation } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // D32: só a criação real de Reservation exige login (CUSTOMER).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria reserva PENDING para um assento (cliente)' })
  create(
    @Body(new ZodValidationPipe(createReservationSchema))
    dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUserRole,
  ): Promise<Reservation> {
    return this.reservationsService.create(dto, user.id);
  }
}
