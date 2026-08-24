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

// D54: ReservationPanel precisa reconciliar com uma Reservation PENDING já
// existente ao revisitar /sessions/[id], em vez de assumir "nenhuma seleção".
describe('GET /reservations/mine/active (D54)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;
  let movieId: string;

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

  it('retorna 204 quando o customer não tem reserva PENDING nesta sessão', async () => {
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token } = await createDisposableCustomer(prisma, 'no-reservation');

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('retorna reservationId/seatId/expiresAt da PENDING ativa do próprio customer', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const seatId = seatIds[0];
    const { user, token } = await createDisposableCustomer(prisma, 'owner');

    const created = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: session.id, seatId });
    expect(created.status).toBe(201);

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reservationId: created.body.id,
      seatId,
    });
    expect(response.body.expiresAt).toBeDefined();

    const reservationInDb = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(reservationInDb.customerId).toBe(user.id);
  });

  it('isolamento: PENDING de outro customer na mesma sessão nunca vaza', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const seatId = seatIds[0];
    const { token: ownerToken } = await createDisposableCustomer(
      prisma,
      'owner-isolation',
    );
    const { token: strangerToken } = await createDisposableCustomer(
      prisma,
      'stranger-isolation',
    );

    const created = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionId: session.id, seatId });
    expect(created.status).toBe(201);

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(response.status).toBe(204);
  });

  it('reserva PENDING vencida (não varrida ainda) não é retornada como ativa — reaproveita o sweep lazy (D05)', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const seatId = seatIds[0];
    const { user, token } = await createDisposableCustomer(
      prisma,
      'stale-owner',
    );

    const staleReservation = await prisma.reservation.create({
      data: {
        sessionId: session.id,
        seatId,
        customerId: user.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .query({ sessionId: session.id })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);

    const staleAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: staleReservation.id },
    });
    expect(staleAfter.status).toBe('EXPIRED');
  });

  it('400 quando sessionId não é informado', async () => {
    const { token } = await createDisposableCustomer(prisma, 'no-session-id');

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it('401 sem autenticação', async () => {
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/reservations/mine/active')
      .query({ sessionId: session.id });

    expect(response.status).toBe(401);
  });
});
