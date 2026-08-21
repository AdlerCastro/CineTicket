import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Session } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { MoviesService } from "@/modules/movies/movies.service";
import { SEATS_PER_ROW } from "@/constants/seat.constants";
import { CreateSessionDto } from "./dto/create-session.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviesService: MoviesService,
  ) {}

  findAll(): Promise<Session[]> {
    return this.prisma.session.findMany({ orderBy: { startsAt: "asc" } });
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException("Sessão não encontrada");
    return session;
  }

  async create(dto: CreateSessionDto, organizerId: string): Promise<Session> {
    // Chamada externa fora da transação — I/O de rede não pode segurar o lock.
    const movie = await this.moviesService.findOrCacheMovie(dto.tmdbId);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          movieId: movie.id,
          organizerId,
          room: dto.room,
          startsAt: dto.startsAt,
          capacity: dto.capacity,
          price: dto.price,
        },
      });

      await tx.seat.createMany({
        data: this.buildSeatLayout(session.id, dto.capacity),
      });

      return session;
    });
  }

  async update(
    id: string,
    dto: UpdateSessionDto,
    organizerId: string,
  ): Promise<Session> {
    const session = await this.findOne(id);

    // D10: escrita restrita ao dono, além do @Roles('ORGANIZER') do controller.
    if (session.organizerId !== organizerId) {
      throw new ForbiddenException(
        "Você não tem permissão para editar esta sessão",
      );
    }

    return this.prisma.session.update({ where: { id }, data: dto });
  }

  private buildSeatLayout(
    sessionId: string,
    capacity: number,
  ): Prisma.SeatCreateManyInput[] {
    const seats: Prisma.SeatCreateManyInput[] = [];
    let remaining = capacity;
    let rowIndex = 0;

    while (remaining > 0) {
      const row = String.fromCharCode(65 + rowIndex);
      const seatsInRow = Math.min(SEATS_PER_ROW, remaining);
      for (let number = 1; number <= seatsInRow; number += 1) {
        seats.push({ sessionId, row, number });
      }
      remaining -= seatsInRow;
      rowIndex += 1;
    }

    return seats;
  }
}
