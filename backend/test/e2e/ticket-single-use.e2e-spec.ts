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

// Sprint 4: roteiro documentado no Sprint 2 (ver histórico do arquivo em
// git blame) finalmente exercitável — payments/ e tickets/ implementados.
// 🔒 project-rules.md §4/§6: ingresso nunca reutilizável, segunda validação
// do mesmo código deve ser rejeitada de forma determinística.
describe('Ingresso não reutilizável (validação de portaria)', () => {
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

  it('segunda validação do mesmo ticket é rejeitada de forma determinística', async () => {
    // 1. Fluxo real: reserva PENDING -> pagamento aprovado -> Ticket VALID.
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: customerToken } = await createDisposableCustomer(
      prisma,
      'ticket-owner',
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId: session.id, seatId: seatIds[0] });
    expect(reservationResponse.status).toBe(201);
    const reservationId = reservationResponse.body.id as string;

    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(paymentResponse.status).toBe(201);
    expect(paymentResponse.body.status).toBe('PAID');

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { reservationId },
    });
    expect(ticket.status).toBe('VALID');

    // 2. Dono consulta o próprio ingresso (JWT retornado pelo endpoint real
    // de consulta, não lido direto do banco).
    const ticketDisplayResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(ticketDisplayResponse.status).toBe(200);
    const jwtToken = ticketDisplayResponse.body.jwt as string;
    expect(typeof jwtToken).toBe('string');

    // 3. Primeira validação de portaria (GATE) — sucesso, marca USED.
    const firstValidation = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: session.id });
    expect(firstValidation.status).toBe(200);
    expect(firstValidation.body.result).toBe('VALIDO');
    expect(firstValidation.body.ticket.status).toBe('USED');

    const ticketAfterFirst = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(ticketAfterFirst.status).toBe('USED');
    expect(ticketAfterFirst.usedAt).not.toBeNull();

    // 4. Segunda validação do MESMO código — rejeição determinística, nunca
    // sucesso.
    const secondValidation = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: session.id });
    expect(secondValidation.status).toBe(409);
    expect(secondValidation.body.result).toBe('JA_USADO');
  });
});
