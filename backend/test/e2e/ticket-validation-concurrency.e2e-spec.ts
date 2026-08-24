import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  GATE_EMAIL,
  ORGANIZER_EMAIL,
  createDisposableCustomer,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
  signAccessToken,
} from './support/fixtures';

// 🔒 project-rules.md §4/§6 + CLAUDE.md #3 (não-negociável): duas validações
// simultâneas do mesmo QR (dois funcionários de portaria, double-tap) devem
// ter exatamente um resultado VALIDO — nunca os dois. Mentalidade
// adversarial, mesmo rigor de reservations-concurrency.e2e-spec.ts (múltiplas
// rodadas, não uma tentativa isolada).
describe('Concorrência na validação de portaria (POST /tickets/validate)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;
  let movieId: string;
  let gateToken: string;

  const VALIDATORS_PER_ROUND = 5;
  const ROUNDS = 5;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    organizerId = organizer.id;
    const movie = await createDisposableMovie(prisma);
    movieId = movie.id;
    const gate = await findSeedUser(prisma, GATE_EMAIL);
    gateToken = signAccessToken(gate.id, gate.role);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(Array.from({ length: ROUNDS }, (_, i) => i + 1))(
    'rodada %i/%i: de %i validações simultâneas do mesmo ticket, exatamente 1 é VALIDO e as demais JA_USADO',
    async (round) => {
      const { session, seatIds } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
      });
      const { token: buyerToken } = await createDisposableCustomer(
        prisma,
        `gate-round${round}-buyer`,
      );

      const reservationResponse = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ sessionId: session.id, seatId: seatIds[0] });
      const reservationId = reservationResponse.body.id as string;

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ reservationId, decision: 'APPROVE' });

      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { reservationId },
      });
      const jwtToken = ticket.code;

      const responses = await Promise.all(
        Array.from({ length: VALIDATORS_PER_ROUND }, () =>
          request(app.getHttpServer())
            .post('/tickets/validate')
            .set('Authorization', `Bearer ${gateToken}`)
            .send({ token: jwtToken, sessionId: session.id }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      const valid = responses.filter((r) => r.status === 200);
      const alreadyUsed = responses.filter((r) => r.status === 409);

      // Nenhuma requisição pode quebrar com erro genérico — só 200 (venceu)
      // ou 409 (já usado, conflito controlado) são resultados aceitáveis.
      expect(statuses.every((status) => status === 200 || status === 409)).toBe(
        true,
      );

      expect(valid).toHaveLength(1);
      expect(valid[0].body.result).toBe('VALIDO');
      expect(alreadyUsed).toHaveLength(VALIDATORS_PER_ROUND - 1);
      alreadyUsed.forEach((response) => {
        expect(response.body.result).toBe('JA_USADO');
      });

      // O banco reflete exatamente USED, uma única vez — a garantia real é o
      // UPDATE condicional atômico, a resposta HTTP é só o reflexo dela.
      const ticketAfter = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(ticketAfter.status).toBe('USED');
    },
  );

  it('EVENTO_ERRADO quando o JWT é válido mas não corresponde à sessão sendo checada', async () => {
    const { session: sessionA, seatIds: seatIdsA } =
      await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
      });
    const { session: sessionB } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: buyerToken } = await createDisposableCustomer(
      prisma,
      'wrong-event-buyer',
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ sessionId: sessionA.id, seatId: seatIdsA[0] });
    const reservationId = reservationResponse.body.id as string;

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ reservationId, decision: 'APPROVE' });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { reservationId },
    });

    // Portaria checando a sessão B com um ticket que pertence à sessão A.
    const response = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: ticket.code, sessionId: sessionB.id });

    expect(response.status).toBe(422);
    expect(response.body.result).toBe('EVENTO_ERRADO');

    const ticketAfter = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(ticketAfter.status).toBe('VALID');
  });

  it('INVALIDO para JWT malformado/assinatura inválida, sem consultar o Ticket', async () => {
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });

    const response = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: 'isto-nao-e-um-jwt-valido', sessionId: session.id });

    expect(response.status).toBe(400);
    expect(response.body.result).toBe('INVALIDO');
  });
});
