import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ReservationsService } from '@/modules/reservations/reservations.service';
import { SessionsService } from '@/modules/sessions/sessions.service';
import { SeatMapItem, SeatStatus } from './dto/seat-map-item.dto';

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
    private readonly sessionsService: SessionsService,
  ) {}

  // Risco #6: mapa de assentos segue a mesma regra de visibilidade da sessão
  // correspondente (published/dono) — reaproveita SessionsService.findOne
  // (que já lança 404 nos dois casos: sessão inexistente ou rascunho de
  // outro organizador/anônimo), em vez de duplicar a checagem aqui.
  async getSeatMap(
    sessionId: string,
    currentUserId?: string | null,
  ): Promise<SeatMapItem[]> {
    await this.sessionsService.findOne(sessionId, currentUserId);

    // D05: sweep lazy antes de ler, senão uma reserva PENDING vencida segue
    // aparecendo como ocupada.
    await this.reservationsService.expireStalePendingForSession(sessionId);

    const seats = await this.prisma.seat.findMany({
      where: { sessionId },
      orderBy: [{ row: 'asc' }, { number: 'asc' }],
      include: {
        reservations: {
          where: {
            status: { in: [ReservationStatus.PENDING, ReservationStatus.PAID] },
          },
          select: { status: true },
          take: 1,
        },
      },
    });

    return seats.map((seat) => ({
      id: seat.id,
      row: seat.row,
      number: seat.number,
      status: (seat.reservations[0]?.status as SeatStatus) ?? 'AVAILABLE',
    }));
  }
}
