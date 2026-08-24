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

// D44 (decisions-log.md): o Gateway WebSocket já recusa join:session pra
// sessão published:false (D40) — o endpoint REST de criação de reserva não
// tinha checagem equivalente. Este spec cobre o gap.
describe('POST /reservations recusa sessão não publicada (D44)', () => {
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

  it('retorna 403 e não cria nenhuma linha de reserva no banco', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
      published: false,
    });
    const seatId = seatIds[0];

    const { token } = await createDisposableCustomer(prisma, 'draft-blocked');

    const response = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: session.id, seatId });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/publicad/i),
    });

    // Confirmar via Prisma, não só o status HTTP — nenhuma linha deve
    // existir para este assento.
    const reservations = await prisma.reservation.findMany({
      where: { seatId },
    });
    expect(reservations).toHaveLength(0);
  });

  it('permite a mesma operação normalmente quando a sessão está publicada (sem regressão)', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
      published: true,
    });
    const seatId = seatIds[0];

    const { token } = await createDisposableCustomer(prisma, 'published-ok');

    const response = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: session.id, seatId });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('PENDING');
  });
});
