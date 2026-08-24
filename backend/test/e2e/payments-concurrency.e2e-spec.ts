import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  ORGANIZER_EMAIL,
  createDisposableCustomer,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
} from './support/fixtures';

// 🔒 project-rules.md §4 (não-negociável) aplicado à transição de estado da
// Reservation em POST /payments, não só à criação de reserva (D06) ou à
// marcação USED do Ticket (ver ticket-validation-concurrency.e2e-spec.ts).
// Achado real durante revisão: a primeira versão desta rota fazia
// "findUniqueOrThrow + checagem de status em JS, depois update incondicional
// por id" — sob concorrência real, múltiplas requisições simultâneas na
// mesma Reservation conseguiam todas passar a checagem antes de qualquer
// uma escrever, causando (a) uma segunda aprovação tentando criar um
// segundo Ticket e estourando a constraint UNIQUE de `Ticket.reservationId`
// como 500 não tratado, e (b) num caso pior, APPROVE e DECLINE concorrentes
// podiam os dois "vencer" (múltiplos 201), deixando a Reservation CANCELLED
// com um Ticket ainda associado. Corrigido com UPDATE...WHERE status =
// 'PENDING' atômico (mesmo padrão de tickets.service.ts#validate).
describe('Concorrência em POST /payments', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;
  let movieId: string;

  const RACERS_PER_ROUND = 5;
  const ROUNDS = 5;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    organizerId = organizer.id;
    const movie = await createDisposableMovie(prisma);
    movieId = movie.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(Array.from({ length: ROUNDS }, (_, i) => i + 1))(
    'rodada %i/%i: de %i APPROVE simultâneos na mesma reserva, exatamente 1 vence e no máximo 1 Ticket é criado',
    async (round) => {
      const { session, seatIds } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
      });
      const { token: buyerToken } = await createDisposableCustomer(
        prisma,
        `pay-race-round${round}`,
      );

      const reservationResponse = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ sessionId: session.id, seatId: seatIds[0] });
      const reservationId = reservationResponse.body.id as string;

      const responses = await Promise.all(
        Array.from({ length: RACERS_PER_ROUND }, () =>
          request(app.getHttpServer())
            .post('/payments')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({ reservationId, decision: 'APPROVE' }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      const approved = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      // Nenhuma requisição pode quebrar com 500 genérico — só 201 (venceu)
      // ou 409 (conflito controlado) são resultados aceitáveis.
      expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
      expect(approved).toHaveLength(1);
      expect(conflicts).toHaveLength(RACERS_PER_ROUND - 1);

      const reservationAfter = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      expect(reservationAfter.status).toBe('PAID');

      const ticketCount = await prisma.ticket.count({
        where: { reservationId },
      });
      expect(ticketCount).toBe(1);
    },
  );

  it.each(Array.from({ length: ROUNDS }, (_, i) => i + 1))(
    'rodada %i/%i: APPROVE e DECLINE simultâneos na mesma reserva nunca deixam estado inconsistente',
    async (round) => {
      const { session, seatIds } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
      });
      const { token: buyerToken } = await createDisposableCustomer(
        prisma,
        `pay-mixed-round${round}`,
      );

      const reservationResponse = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ sessionId: session.id, seatId: seatIds[0] });
      const reservationId = reservationResponse.body.id as string;

      const decisions = ['APPROVE', 'DECLINE', 'APPROVE', 'DECLINE'] as const;
      const responses = await Promise.all(
        decisions.map((decision) =>
          request(app.getHttpServer())
            .post('/payments')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({ reservationId, decision }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      const succeeded = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
      // Exatamente uma decisão vence, não importa qual (a ordem de chegada
      // no banco decide, não a ordem de disparo em JS) — nunca as duas.
      expect(succeeded).toHaveLength(1);
      expect(conflicts).toHaveLength(decisions.length - 1);

      const reservationAfter = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      const ticketCount = await prisma.ticket.count({
        where: { reservationId },
      });

      // Estado final sempre consistente com a decisão vencedora — nunca um
      // Ticket sobrevivendo a uma Reservation CANCELLED, nunca uma
      // Reservation PAID sem Ticket correspondente.
      if (reservationAfter.status === 'PAID') {
        expect(ticketCount).toBe(1);
      } else {
        expect(reservationAfter.status).toBe('CANCELLED');
        expect(ticketCount).toBe(0);
      }
    },
  );
});
