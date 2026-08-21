import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reservation, ReservationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RESERVATION_TTL_MINUTES } from '@/constants/reservation.constants';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  // D05, verificação lazy (ver .context/project-state.md): a constraint
  // UNIQUE parcial só cobre status PENDING/PAID, então uma linha PENDING
  // vencida continua bloqueando o assento até isto rodar.
  async expireStalePendingForSession(sessionId: string): Promise<void> {
    await this.prisma.reservation.updateMany({
      where: {
        sessionId,
        status: ReservationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: ReservationStatus.EXPIRED },
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
      return await this.prisma.$transaction(async (tx) => {
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
