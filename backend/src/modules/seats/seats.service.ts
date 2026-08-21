import { Injectable, NotFoundException } from "@nestjs/common";
import { ReservationStatus } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { ReservationsService } from "@/modules/reservations/reservations.service";
import { SeatMapItem, SeatStatus } from "./dto/seat-map-item.dto";

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
  ) {}

  async getSeatMap(sessionId: string): Promise<SeatMapItem[]> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException("Sessão não encontrada");

    // D05: sweep lazy antes de ler, senão uma reserva PENDING vencida segue
    // aparecendo como ocupada.
    await this.reservationsService.expireStalePendingForSession(sessionId);

    const seats = await this.prisma.seat.findMany({
      where: { sessionId },
      orderBy: [{ row: "asc" }, { number: "asc" }],
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
      status: (seat.reservations[0]?.status as SeatStatus) ?? "AVAILABLE",
    }));
  }
}
