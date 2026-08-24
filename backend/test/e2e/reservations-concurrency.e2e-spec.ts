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

// Regra não-negociável (project-rules.md §4 / CLAUDE.md #1): duas requisições
// concorrentes para o mesmo assento nunca podem, as duas, resultar em
// reserva ativa. Mentalidade adversarial — tenta genuinamente derrubar a
// constraint UNIQUE parcial + transação, não apenas confirmar o caminho
// feliz.
describe('Concorrência de assento (POST /reservations)', () => {
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
    'rodada %i/%i: de %i requisições simultâneas para o mesmo assento, exatamente 1 vence e as demais recebem 409',
    async (round) => {
      // Sessão + único assento descartáveis, criados direto via Prisma —
      // nunca a sessão/assentos do seed.
      const { session, seatIds } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
      });
      const seatId = seatIds[0];

      // Mais corredores do que os 2 clientes fixos do seed, para reduzir a
      // chance de falso positivo por sorte de timing entre só duas requisições.
      const racers = await Promise.all(
        Array.from({ length: RACERS_PER_ROUND }, (_, i) =>
          createDisposableCustomer(prisma, `round${round}-racer${i}`),
        ),
      );

      const responses = await Promise.all(
        racers.map(({ token }) =>
          request(app.getHttpServer())
            .post('/reservations')
            .set('Authorization', `Bearer ${token}`)
            .send({ sessionId: session.id, seatId }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      const created = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      // Nenhuma requisição pode quebrar com erro genérico — só 201 (venceu)
      // ou 409 (conflito controlado) são resultados aceitáveis.
      expect(statuses.every((status) => status === 201 || status === 409)).toBe(
        true,
      );

      expect(created).toHaveLength(1);
      expect(conflicts).toHaveLength(RACERS_PER_ROUND - 1);
      conflicts.forEach((response) => {
        expect(response.body).toMatchObject({
          message: expect.stringMatching(/reservad/i),
        });
      });

      // O banco reflete exatamente 1 reserva ativa (PENDING/PAID) para o
      // assento — a garantia real é a constraint, a resposta HTTP é só o
      // reflexo dela.
      const activeReservations = await prisma.reservation.count({
        where: { seatId, status: { in: ['PENDING', 'PAID'] } },
      });
      expect(activeReservations).toBe(1);
    },
  );
});
