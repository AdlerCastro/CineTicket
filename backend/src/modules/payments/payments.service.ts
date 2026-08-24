import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ReservationsService } from '@/modules/reservations/reservations.service';
import { TicketsService } from '@/modules/tickets/tickets.service';
import { SeatsGateway } from '@/modules/gateway/seats.gateway';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
    private readonly ticketsService: TicketsService,
    private readonly seatsGateway: SeatsGateway,
  ) {}

  async process(
    dto: ProcessPaymentDto,
    customerId: string,
  ): Promise<Reservation> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
    });
    if (!reservation) throw new NotFoundException('Reserva não encontrada');

    // Só o customer dono da Reservation pode pagar/recusar a própria reserva
    // — guard equivalente ao já usado em reservations/.
    if (reservation.customerId !== customerId) {
      throw new ForbiddenException(
        'Você não tem permissão para pagar esta reserva',
      );
    }

    // Reaproveita a mesma checagem de expiração lazy do módulo reservations
    // (D05) — não duplica a lógica aqui.
    await this.reservationsService.expireStalePendingForSession(
      reservation.sessionId,
    );

    const current = await this.prisma.reservation.findUniqueOrThrow({
      where: { id: dto.reservationId },
    });

    // Cobre reserva expirada (sweep acima já teria virado EXPIRED),
    // cancelada ou já paga — nenhuma dessas pode ser paga/recusada de novo.
    if (current.status !== ReservationStatus.PENDING) {
      throw new ConflictException(
        'Reserva não está mais pendente de pagamento (expirada, já paga ou cancelada)',
      );
    }

    if (dto.decision === 'DECLINE') {
      return this.decline(current);
    }

    return this.approve(current);
  }

  private async decline(reservation: Reservation): Promise<Reservation> {
    const declined = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CANCELLED },
    });

    // Mesmo padrão do sweep de expiração: assento libera imediatamente.
    this.seatsGateway.emitSeatUpdate(declined.sessionId, {
      seatId: declined.seatId,
      status: 'AVAILABLE',
    });

    return declined;
  }

  private async approve(reservation: Reservation): Promise<Reservation> {
    // Ticket gerado NA MESMA transação da aprovação do pagamento — decisão
    // documentada em .context/project-state.md (ver também
    // TicketsService.createForReservation).
    const paid = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.PAID },
      });
      await this.ticketsService.createForReservation(updated.id, tx);
      return updated;
    });

    this.seatsGateway.emitSeatUpdate(paid.sessionId, {
      seatId: paid.seatId,
      status: 'PAID',
    });

    return paid;
  }
}
