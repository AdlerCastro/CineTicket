import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RESERVATION_TTL_MINUTES } from '@/constants/reservation.constants';
import { SeatsGateway } from '@/modules/gateway/seats.gateway';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seatsGateway: SeatsGateway,
  ) {}

  // D05, verificação lazy (ver .context/project-state.md): a constraint
  // UNIQUE parcial só cobre status PENDING/PAID, então uma linha PENDING
  // vencida continua bloqueando o assento até isto rodar.
  async expireStalePendingForSession(sessionId: string): Promise<void> {
    const staleReservations = await this.prisma.reservation.findMany({
      where: {
        sessionId,
        status: ReservationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      select: { id: true, seatId: true },
    });

    if (staleReservations.length === 0) return;

    await this.prisma.reservation.updateMany({
      where: {
        id: { in: staleReservations.map((reservation) => reservation.id) },
      },
      data: { status: ReservationStatus.EXPIRED },
    });

    // Sprint 3 (D39/D40): sweep lazy já existia — só ganhou o side-effect de
    // avisar quem está olhando o mapa em tempo real que o assento voltou.
    staleReservations.forEach((reservation) => {
      this.seatsGateway.emitSeatUpdate(sessionId, {
        seatId: reservation.seatId,
        status: 'AVAILABLE',
      });
    });
  }

  async create(
    dto: CreateReservationDto,
    customerId: string,
  ): Promise<Reservation> {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    // D44: equivalente REST da checagem já feita pelo Gateway (D40) em
    // join:session. Mensagem explícita aqui — diferente do Gateway, que usa
    // texto genérico pra não vazar "existe mas é rascunho" a quem só está
    // sondando sem autenticação. Criar reserva já exige login (D32), então
    // quem chega até aqui não é um estranho sondando às cegas.
    if (!session.published) {
      throw new ForbiddenException(
        'Sessão ainda não publicada — não é possível reservar assentos',
      );
    }

    const seat = await this.prisma.seat.findFirst({
      where: { id: dto.seatId, sessionId: dto.sessionId },
    });
    if (!seat) {
      throw new NotFoundException('Assento não encontrado nesta sessão');
    }

    await this.expireStalePendingForSession(dto.sessionId);

    try {
      // 🔒 project-rules.md §4: quem impede a corrida é a constraint UNIQUE
      // parcial (sessionId, seatId) WHERE status IN ('PENDING','PAID') — a
      // segunda tentativa concorrente falha aqui com P2002.
      const reservation = await this.prisma.$transaction(async (tx) => {
        return tx.reservation.create({
          data: {
            sessionId: dto.sessionId,
            seatId: dto.seatId,
            customerId,
            status: ReservationStatus.PENDING,
            expiresAt: new Date(
              Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000,
            ),
          },
        });
      });

      this.seatsGateway.emitSeatUpdate(dto.sessionId, {
        seatId: dto.seatId,
        status: 'PENDING',
      });

      return reservation;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Assento já reservado');
      }
      throw error;
    }
  }
}
