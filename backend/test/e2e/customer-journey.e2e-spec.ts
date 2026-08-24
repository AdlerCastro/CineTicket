import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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

interface SeatMapItemResponse {
  id: string;
  status: string;
}

// D49: jornada completa do Cliente, encadeando chamadas HTTP reais na ordem
// que um usuário de verdade faria — login real via POST /auth/login (não
// signAccessToken, ao contrário dos specs de módulo isolado), sem mockar
// nenhum passo. Em cada passo, a asserção cobre o shape/presença do campo
// que o PRÓXIMO passo consome — é exatamente esse tipo de checagem que teria
// pego os dois furos reais já encontrados nos Sprints anteriores (D44:
// reserva em sessão rascunho; Sprint 4: ticketId ausente na resposta de
// pagamento).
describe('Jornada completa do Cliente (reserva → pagamento → ingresso → validação)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('percorre a jornada inteira sem quebrar contrato entre passos', async () => {
    // 1. Login real do cliente — o próximo passo consome accessToken.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL, password: SEED_PASSWORD });
    expect(loginResponse.status).toBe(201);
    expect(typeof loginResponse.body.accessToken).toBe('string');
    expect(loginResponse.body.user).toMatchObject({ role: 'CUSTOMER' });
    // Regra não-negociável #4 (CLAUDE.md backend): campo sensível nunca sai
    // num response.
    expect(loginResponse.body.user.password).toBeUndefined();
    expect(loginResponse.body.user.refreshTokenHash).toBeUndefined();
    const customerToken = loginResponse.body.accessToken as string;

    // Sessão publicada de teste, descartável — a jornada do cliente não
    // exercita a criação de sessão (isso é a Jornada 2, organizador).
    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    const movie = await createDisposableMovie(prisma);
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId: organizer.id,
      movieId: movie.id,
      seatCount: 3,
      published: true,
    });

    // 2. GET /sessions (listar) — o próximo passo consome session.id.
    const listResponse = await request(app.getHttpServer()).get('/sessions');
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    const listedSession = listResponse.body.find(
      (s: { id: string }) => s.id === session.id,
    );
    expect(listedSession).toBeDefined();
    expect(listedSession.movie).toBeDefined();

    // 3. GET /sessions/:id (detalhe) — confirma `movie` presente (furo real
    // já encontrado no Sprint 3/D44: catálogo de filme ausente da resposta).
    const detailResponse = await request(app.getHttpServer()).get(
      `/sessions/${session.id}`,
    );
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.movie).toMatchObject({
      id: movie.id,
      title: expect.any(String),
    });

    // 4. GET /sessions/:id/seats — o próximo passo consome um seatId
    // AVAILABLE real do mapa, não um id assumido a partir da fixture.
    const seatsResponse = await request(app.getHttpServer()).get(
      `/sessions/${session.id}/seats`,
    );
    expect(seatsResponse.status).toBe(200);
    const seatEntries = seatsResponse.body as SeatMapItemResponse[];
    expect(seatEntries).toHaveLength(3);
    const availableSeat = seatEntries.find((s) => s.status === 'AVAILABLE');
    expect(availableSeat).toBeDefined();
    expect(seatIds).toContain(availableSeat!.id);
    const seatId = availableSeat!.id;

    // 5. POST /reservations — o próximo passo (pagamento) consome
    // reservation.id.
    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId: session.id, seatId });
    expect(reservationResponse.status).toBe(201);
    expect(reservationResponse.body).toMatchObject({
      id: expect.any(String),
      status: 'PENDING',
      seatId,
      sessionId: session.id,
    });
    expect(reservationResponse.body.expiresAt).toBeDefined();
    const reservationId = reservationResponse.body.id as string;

    // 6. POST /payments (APPROVE) — asserção do furo real já encontrado no
    // Sprint 4: ticketId precisa estar presente e utilizável, não só
    // status: 'PAID'.
    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(paymentResponse.status).toBe(201);
    expect(paymentResponse.body.status).toBe('PAID');
    expect(typeof paymentResponse.body.ticketId).toBe('string');
    const ticketId = paymentResponse.body.ticketId as string;

    // 7. GET /tickets/:id, usando o ticketId da resposta de pagamento (não
    // um id lido direto do banco) — o próximo passo consome o `jwt`.
    const ticketResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(ticketResponse.status).toBe(200);
    expect(ticketResponse.body.id).toBe(ticketId);
    expect(ticketResponse.body.status).toBe('VALID');
    expect(typeof ticketResponse.body.jwt).toBe('string');
    expect(ticketResponse.body.session.movie).toBeDefined();
    expect(ticketResponse.body.seat.id).toBe(seatId);
    const jwtToken = ticketResponse.body.jwt as string;

    // 8. Confirma que o JWT retornado é de fato válido (assinatura real,
    // payload utilizável) — não só uma string presente. Sem isso, um
    // GET /tickets/:id que devolvesse lixo assinado errado passaria batido
    // por uma asserção de `typeof === 'string'` sozinha.
    const ticketSecret = process.env.JWT_TICKET_SECRET;
    expect(ticketSecret).toBeDefined();
    const decoded = jwt.verify(jwtToken, ticketSecret!) as { ticketId: string };
    expect(decoded.ticketId).toBe(ticketId);

    // 9. Login de um segundo usuário (GATE) — a validação de portaria exige
    // um usuário diferente do comprador, refletindo o mundo real.
    const gateLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: GATE_EMAIL, password: SEED_PASSWORD });
    expect(gateLoginResponse.status).toBe(201);
    expect(gateLoginResponse.body.user).toMatchObject({ role: 'GATE' });
    const gateToken = gateLoginResponse.body.accessToken as string;

    // 10. POST /tickets/validate — primeira validação, VALIDO.
    const firstValidation = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: session.id });
    expect(firstValidation.status).toBe(200);
    expect(firstValidation.body.result).toBe('VALIDO');
    expect(firstValidation.body.ticket.id).toBe(ticketId);

    // 11. Revalidação do mesmo ticket — JA_USADO, de forma determinística.
    const secondValidation = await request(app.getHttpServer())
      .post('/tickets/validate')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ token: jwtToken, sessionId: session.id });
    expect(secondValidation.status).toBe(409);
    expect(secondValidation.body.result).toBe('JA_USADO');

    // Confirma o estado final via banco, não só a última resposta HTTP.
    const ticketAfter = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ticketAfter.status).toBe('USED');
    expect(ticketAfter.usedAt).not.toBeNull();
  });
});
