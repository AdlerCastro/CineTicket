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

const NOT_PAYABLE_MESSAGE =
  'Reserva não está mais pendente de pagamento (expirada, já paga ou cancelada)';

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
    // — guard equivalente ao já usado em reservations/. Leitura, não altera
    // estado, então não faz parte da corrida abaixo.
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

    if (dto.decision === 'DECLINE') {
      return this.decline(dto.reservationId, reservation.sessionId);
    }

    return this.approve(dto.reservationId, reservation.sessionId);
  }

  private async decline(
    reservationId: string,
    sessionId: string,
  ): Promise<Reservation> {
    // 🔒 Mesmo padrão de tickets.service.ts#validate: UPDATE ... WHERE
    // status='PENDING' é atômico — não é "check then update" em duas
    // queries separadas (achado corrigido em 24/08: a versão anterior fazia
    // findUniqueOrThrow + checagem de status em JS, depois um update
    // incondicional por id — sob concorrência real, dois POST /payments
    // simultâneos na mesma reserva conseguiam os dois "vencer", um deles
    // sobrescrevendo o status decidido pelo outro). Só uma requisição
    // consegue sair de PENDING; as demais recebem count=0 e 409 limpo.
    const updateResult = await this.prisma.reservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.PENDING },
      data: { status: ReservationStatus.CANCELLED },
    });

    if (updateResult.count === 0) {
      throw new ConflictException(NOT_PAYABLE_MESSAGE);
    }

    const declined = await this.prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });

    // Mesmo padrão do sweep de expiração: assento libera imediatamente.
    this.seatsGateway.emitSeatUpdate(sessionId, {
      seatId: declined.seatId,
      status: 'AVAILABLE',
    });

    return declined;
  }

  private async approve(
    reservationId: string,
    sessionId: string,
  ): Promise<Reservation> {
    // Ticket gerado NA MESMA transação da aprovação do pagamento — decisão
    // documentada em .context/project-state.md. A transição de estado
    // PENDING->PAID é condicional (mesmo raciocínio de decline() acima): só
    // quem vence a corrida chega a criar o Ticket, o que também evita a
    // violação de `Ticket.reservationId @unique` que uma segunda aprovação
    // concorrente causaria (e que antes vazava como 500 não tratado).
    const paid = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.reservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.PENDING },
        data: { status: ReservationStatus.PAID },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(NOT_PAYABLE_MESSAGE);
      }

      const updated = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      await this.ticketsService.createForReservation(updated.id, tx);
      return updated;
    });

    this.seatsGateway.emitSeatUpdate(sessionId, {
      seatId: paid.seatId,
      status: 'PAID',
    });

    return paid;
  }
}
