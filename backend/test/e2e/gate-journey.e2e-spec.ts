import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  CUSTOMER1_EMAIL,
  GATE_EMAIL,
  SEED_PASSWORD,
  ORGANIZER_EMAIL,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
} from './support/fixtures';

// D49: jornada completa da Portaria — cobre os 4 resultados exatos de
// project-description.md dentro de UM fluxo coerente (não casos isolados
// sem relação entre si): emitir um ticket real via login+reserva+pagamento,
// depois validar em sequência VALIDO → JA_USADO → INVALIDO → EVENTO_ERRADO,
// confirmando que os status HTTP batem com o mapeamento documentado em
// project-state.md (200/400/409/422).
describe('Jornada completa da Portaria (VALIDO → JA_USADO → INVALIDO → EVENTO_ERRADO)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('percorre os 4 resultados de validação em sequência sobre um ticket real', async () => {
    // Setup: duas sessões publicadas descartáveis — a segunda existe só
    // para o cenário EVENTO_ERRADO (ticket pertence à sessão A, validado
    // contra a sessão B).
    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    const movie = await createDisposableMovie(prisma);
    const { session: sessionA, seatIds: seatIdsA } =
      await createDisposableSession(prisma, {
        organizerId: organizer.id,
        movieId: movie.id,
        seatCount: 1,
        published: true,
      });
    const { session: sessionB } = await createDisposableSession(prisma, {
      organizerId: organizer.id,
      movieId: movie.id,
      seatCount: 1,
      published: true,
    });

    // 1. Emitir um ticket real via a mesma jornada de pagamento do cliente
    // (login real, não signAccessToken) — login → reserva → pagamento.
    const customerLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL, password: SEED_PASSWORD });
    expect(customerLoginResponse.status).toBe(201);
    const customerToken = customerLoginResponse.body.accessToken as string;

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId: sessionA.id, seatId: seatIdsA[0] });
    expect(reservationResponse.status).toBe(201);
    const reservationId = reservationResponse.body.id as string;

    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(paymentResponse.status).toBe(201);
    expect(typeof paymentResponse.body.ticketId).toBe('string');
    const ticketId = paymentResponse.body.ticketId as string;

    const ticketResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(ticketResponse.status).toBe(200);
    const jwtToken = ticketResponse.body.jwt as string;
    expect(typeof jwtToken).toBe('string');

    // Login real do funcionário de portaria.
    const gateLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: GATE_EMAIL, password: SEED_PASSWORD });
    expect(gateLoginResponse.status).toBe(201);
    expect(gateLoginResponse.body.user).toMatchObject({ role: 'GATE' });
    const gateToken = gateLoginResponse.body.accessToken as string;

    // 2. VALIDO — 200.
    const validResult = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: sessionA.id });
    expect(validResult.status).toBe(200);
    expect(validResult.body.result).toBe('VALIDO');
    expect(validResult.body.ticket.id).toBe(ticketId);

    // 3. Revalidar o MESMO ticket — JA_USADO — 409.
    const alreadyUsedResult = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: sessionA.id });
    expect(alreadyUsedResult.status).toBe(409);
    expect(alreadyUsedResult.body.result).toBe('JA_USADO');

    // 4. JWT malformado — INVALIDO — 400.
    const invalidResult = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: 'nao-e-um-jwt-valido', sessionId: sessionA.id });
    expect(invalidResult.status).toBe(400);
    expect(invalidResult.body.result).toBe('INVALIDO');

    // 5. Ticket real (já USED) validado contra uma sessionId diferente da
    // sua — EVENTO_ERRADO tem precedência sobre JA_USADO (decisão
    // documentada em project-state.md) — 422.
    const wrongEventResult = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: sessionB.id });
    expect(wrongEventResult.status).toBe(422);
    expect(wrongEventResult.body.result).toBe('EVENTO_ERRADO');

    // Estado final do banco reflete exatamente USED, uma única vez — os 4
    // resultados acima nunca alteraram o ticket além da primeira validação.
    const ticketAfter = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ticketAfter.status).toBe('USED');
  });
});
