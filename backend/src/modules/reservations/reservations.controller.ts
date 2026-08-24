import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReservationSchema } from '@cineticket/shared';
import { Reservation } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/role.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthenticatedUserRole } from '@/common/types/authenticated-request.type';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ActiveReservationResponse } from './dto/active-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // D54: reconciliação do ReservationPanel ao revisitar /sessions/[id] —
  // "existe uma PENDING minha nesta sessão?" antes de assumir "nenhuma
  // seleção". `sessionId` vem de query string simples (mesmo padrão de
  // `@Query('query')` em movies.controller.ts, sem Zod: é um único parâmetro
  // primitivo, não um corpo estruturado que precise de schema em
  // packages/shared). 204 (não 200 + `null`) quando não há reserva ativa:
  // testado que o Nest, ao devolver `null`/`undefined` do handler, já manda
  // corpo vazio (content-length 0, sem Content-Type) — 200 com esse corpo
  // seria "sucesso" com um body que não é JSON parseável, pior contrato que
  // simplesmente assumir o 204 que o framework já produz de fato.
  @Get('mine/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Reserva PENDING do customer autenticado numa sessão, se existir (204 se não houver)',
  })
  async findMyActiveForSession(
    @Query('sessionId') sessionId: string | undefined,
    @CurrentUser() user: AuthenticatedUserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActiveReservationResponse | undefined> {
    if (!sessionId) {
      throw new BadRequestException('sessionId é obrigatório');
    }

    const reservation = await this.reservationsService.findActiveMineForSession(
      user.id,
      sessionId,
    );
    if (!reservation) {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }

    return reservation;
  }

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
