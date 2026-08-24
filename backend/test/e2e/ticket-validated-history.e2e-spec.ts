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

// D56: histórico de ingressos validados na portaria (GET /tickets/validated),
// filtrado por sessão. Reaproveita o mesmo roteiro reserva -> pagamento ->
// validação já usado em ticket-single-use.e2e-spec.ts, repetido algumas
// vezes para popular o histórico.
describe('GET /tickets/validated (histórico da portaria)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;
  let movieId: string;
  let gateToken: string;

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

  async function buyAndValidate(
    sessionId: string,
    seatId: string,
    label: string,
  ): Promise<{ ticketId: string }> {
    const { token: customerToken } = await createDisposableCustomer(
      prisma,
      label,
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId, seatId });
    expect(reservationResponse.status).toBe(201);
    const reservationId = reservationResponse.body.id as string;

    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(paymentResponse.status).toBe(201);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { reservationId },
    });

    const ticketDisplayResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    const jwtToken = ticketDisplayResponse.body.jwt as string;

    const validation = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId });
    expect(validation.status).toBe(200);
    expect(validation.body.result).toBe('VALIDO');

    return { ticketId: ticket.id };
  }

  it('sessão sem nenhum ticket validado retorna array vazio', async () => {
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/tickets/validated')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${gateToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('lista só tickets USED da sessão pedida, mais recente primeiro, sem vazar de outra sessão', async () => {
    const sessionA = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 3,
    });
    const sessionB = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });

    // Ticket não-validado na sessão A: comprado mas nunca passa na portaria —
    // não deve aparecer no histórico (só USED, não qualquer ticket da sessão).
    await createDisposableCustomer(prisma, 'unused-buyer').then(
      async ({ token }) => {
        const reservation = await request(app.getHttpServer())
          .post('/reservations')
          .set('Authorization', `Bearer ${token}`)
          .send({
            sessionId: sessionA.session.id,
            seatId: sessionA.seatIds[2],
          });
        await request(app.getHttpServer())
          .post('/payments')
          .set('Authorization', `Bearer ${token}`)
          .send({ reservationId: reservation.body.id, decision: 'APPROVE' });
      },
    );

    const first = await buyAndValidate(
      sessionA.session.id,
      sessionA.seatIds[0],
      'validated-first',
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await buyAndValidate(
      sessionA.session.id,
      sessionA.seatIds[1],
      'validated-second',
    );

    // Ticket validado em OUTRA sessão — não pode vazar para o histórico de A.
    await buyAndValidate(
      sessionB.session.id,
      sessionB.seatIds[0],
      'validated-other-session',
    );

    const response = await request(app.getHttpServer())
      .get('/tickets/validated')
      .query({ sessionId: sessionA.session.id })
      .set('Authorization', `Bearer ${gateToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.map((t: { id: string }) => t.id)).toEqual([
      second.ticketId,
      first.ticketId,
    ]);
    response.body.forEach(
      (ticket: { status: string; usedAt: string | null }) => {
        expect(ticket.status).toBe('USED');
        expect(ticket.usedAt).not.toBeNull();
      },
    );
  });

  it('400 sem sessionId', async () => {
    const response = await request(app.getHttpServer())
      .get('/tickets/validated')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(response.status).toBe(400);
  });

  it('403 para papel diferente de GATE', async () => {
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: customerToken } = await createDisposableCustomer(
      prisma,
      'not-gate',
    );

    const response = await request(app.getHttpServer())
      .get('/tickets/validated')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(403);
  });
});
