import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Ticket, TicketStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AppConfigService } from '@/config/config.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import {
  TicketDisplayResponse,
  ValidateTicketResponse,
} from './dto/ticket-display.dto';

// Reaproveita a relação movie já incluída em sessions desde D44.
const TICKET_WITH_DETAILS_INCLUDE = {
  reservation: {
    include: {
      session: { include: { movie: true } },
      seat: true,
    },
  },
} as const;

type TicketWithDetails = Prisma.TicketGetPayload<{
  include: typeof TICKET_WITH_DETAILS_INCLUDE;
}>;

interface TicketJwtPayload {
  ticketId: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  // Chamado pelo PaymentsService dentro da MESMA transação da aprovação do
  // pagamento (ver payments.service.ts) — decisão documentada em
  // .context/project-state.md: geração de ticket é local/pura (sem I/O
  // externo), então incluir na transação evita o estado inconsistente de uma
  // Reservation PAID sem Ticket correspondente.
  async createForReservation(
    reservationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Ticket> {
    const ticketId = randomUUID();
    const token = this.signToken(ticketId);

    return tx.ticket.create({
      data: {
        id: ticketId,
        reservationId,
        code: token,
        status: TicketStatus.VALID,
      },
    });
  }

  async findByIdForCustomer(
    id: string,
    customerId: string,
  ): Promise<TicketDisplayResponse> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_WITH_DETAILS_INCLUDE,
    });
    if (!ticket) throw new NotFoundException('Ingresso não encontrado');

    // Só o customer dono da Reservation original enxerga o próprio ingresso
    // — mesmo padrão de ownership já usado em payments/reservations.
    if (ticket.reservation.customerId !== customerId) {
      throw new ForbiddenException(
        'Você não tem permissão para ver este ingresso',
      );
    }

    return this.toDisplayResponse(ticket);
  }

  // D53: listagem dos próprios ingressos (GET /tickets/mine). Mesmo shape de
  // findByIdForCustomer (reaproveita toDisplayResponse) e mesma cadeia de
  // ownership via reservation.customerId — só troca findUnique+id por
  // findMany filtrado. Ordenação por Ticket.createdAt desc (mais recente
  // primeiro): é a data de emissão do próprio ingresso, mais direta que
  // Reservation.createdAt (que marca o início da reserva, não a emissão).
  async findAllForCustomer(
    customerId: string,
  ): Promise<TicketDisplayResponse[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { reservation: { customerId } },
      include: TICKET_WITH_DETAILS_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return tickets.map((ticket) => this.toDisplayResponse(ticket));
  }

  async validate(dto: ValidateTicketDto): Promise<ValidateTicketResponse> {
    // Assinatura validada ANTES de qualquer consulta ao banco (project-rules
    // desta tarefa) — verifyToken lança sem ter tocado o Prisma.
    const payload = this.verifyToken(dto.token);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      include: TICKET_WITH_DETAILS_INCLUDE,
    });
    if (!ticket) {
      throw new BadRequestException({
        result: 'INVALIDO',
        message: 'Ingresso não encontrado',
      });
    }

    // EVENTO_ERRADO é checado antes do estado de uso: é um descasamento de
    // identidade (este ingresso nunca pertenceu à sessão que esta portaria
    // está validando), independente de já ter sido usado ou não. Ambiguidade
    // resolvida sem travar a tarefa — ver .context/project-state.md.
    if (ticket.reservation.sessionId !== dto.sessionId) {
      throw new UnprocessableEntityException({
        result: 'EVENTO_ERRADO',
        message:
          'Ingresso não corresponde à sessão sendo validada nesta portaria',
      });
    }

    // 🔒 project-rules.md §4 / CLAUDE.md #2: UPDATE ... WHERE status='VALID'
    // é atômico no Postgres (avaliado e aplicado sob lock de linha) — não é
    // "check then update" em duas queries separadas. Sob concorrência real,
    // só uma requisição altera a linha; as demais reavaliam o WHERE contra o
    // estado já committed (USED) e afetam 0 linhas. Mesmo espírito de D06
    // (proteção real é no banco, não na aplicação), via UPDATE condicional
    // em vez de constraint UNIQUE (aqui não há "segunda linha" a impedir,
    // só uma transição de estado a proteger).
    const updateResult = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: TicketStatus.VALID },
      data: { status: TicketStatus.USED, usedAt: new Date() },
    });

    if (updateResult.count === 0) {
      throw new ConflictException({
        result: 'JA_USADO',
        message: 'Ingresso já foi utilizado',
      });
    }

    const updated = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: TICKET_WITH_DETAILS_INCLUDE,
    });

    return { result: 'VALIDO', ticket: this.toDisplayResponse(updated) };
  }

  private signToken(ticketId: string): string {
    // Payload mínimo necessário pra validação — nenhum dado pessoal (o QR
    // pode ser fotografado/compartilhado). Sem `expiresIn`: o ingresso não
    // expira por tempo, só passa a ser rejeitado quando status vira USED —
    // decisão documentada em .context/project-state.md.
    const payload: TicketJwtPayload = { ticketId };
    return jwt.sign(payload, this.config.jwtTicketSecret);
  }

  private verifyToken(token: string): TicketJwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtTicketSecret);
      if (typeof decoded === 'string' || !decoded.ticketId) {
        throw new Error('Payload sem ticketId');
      }
      return { ticketId: decoded.ticketId as string };
    } catch {
      throw new BadRequestException({
        result: 'INVALIDO',
        message: 'Assinatura inválida ou ingresso malformado',
      });
    }
  }

  private toDisplayResponse(ticket: TicketWithDetails): TicketDisplayResponse {
    const { reservation } = ticket;
    return {
      id: ticket.id,
      status: ticket.status,
      jwt: ticket.code,
      usedAt: ticket.usedAt,
      session: {
        id: reservation.session.id,
        room: reservation.session.room,
        startsAt: reservation.session.startsAt,
        movie: {
          id: reservation.session.movie.id,
          title: reservation.session.movie.title,
          posterUrl: reservation.session.movie.posterUrl,
        },
      },
      seat: {
        id: reservation.seat.id,
        row: reservation.seat.row,
        number: reservation.seat.number,
      },
    };
  }
}
