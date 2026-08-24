import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Session } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MoviesService } from '@/modules/movies/movies.service';
import { SEATS_PER_ROW } from '@/constants/seat.constants';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

// D44: Movie não tem campo interno/de cache que precise ser filtrado (ao
// contrário de User, que tem password/refreshTokenHash de verdade) — por
// isso a relação inteira é incluída via Prisma `include`, sem select
// explícito, no mesmo padrão já usado pelo restante do módulo (Session/Seat
// também retornam o model cru, só User aplica filtro campo a campo).
const SESSION_WITH_MOVIE_INCLUDE = { movie: true } as const;

export type SessionWithMovie = Prisma.SessionGetPayload<{
  include: typeof SESSION_WITH_MOVIE_INCLUDE;
}>;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviesService: MoviesService,
  ) {}

  // Risco #6: sessão published:false só é visível pro organizador dono —
  // pra qualquer outro (anônimo ou outro organizador), a sessão é filtrada
  // da listagem. `currentUserId` vem de auth OPCIONAL (OptionalJwtAuthGuard,
  // ver sessions.controller.ts) — undefined/null tratado como visitante.
  findAll(currentUserId?: string | null): Promise<SessionWithMovie[]> {
    return this.prisma.session.findMany({
      where: currentUserId
        ? { OR: [{ published: true }, { organizerId: currentUserId }] }
        : { published: true },
      orderBy: { startsAt: 'asc' },
      include: SESSION_WITH_MOVIE_INCLUDE,
    });
  }

  // Risco #6: mesma regra de findAll, para leitura de uma sessão específica.
  // 404 (não 403) quando published:false e quem pede não é o dono — mesmo
  // raciocínio de "não vazar informação" já usado pelo Gateway (D40): não dá
  // pra confirmar que a sessão existe pra quem não deveria saber.
  async findOne(
    id: string,
    currentUserId?: string | null,
  ): Promise<SessionWithMovie> {
    const session = await this.findRaw(id);
    const isOwner =
      currentUserId != null && session.organizerId === currentUserId;
    if (!session.published && !isOwner) {
      throw new NotFoundException('Sessão não encontrada');
    }
    return session;
  }

  // Busca sem filtro de visibilidade — só existência. Usado por update()
  // (organizador precisa conseguir buscar a própria sessão rascunho pra
  // editar; a checagem de dono ali já é feita separadamente, com 403 em vez
  // de 404, porque quem chama update() já está autenticado e não está só
  // "olhando", D10) e pelo Gateway (D40, sem exceção pro dono).
  private async findRaw(id: string): Promise<SessionWithMovie> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: SESSION_WITH_MOVIE_INCLUDE,
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
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
    const session = await this.findRaw(id);

    // D10: escrita restrita ao dono, além do @Roles('ORGANIZER') do controller.
    if (session.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Você não tem permissão para editar esta sessão',
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
