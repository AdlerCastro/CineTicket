import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  CUSTOMER2_EMAIL,
  ORGANIZER_EMAIL,
  SEED_PASSWORD,
} from './support/fixtures';

interface SeatMapItemResponse {
  id: string;
  status: string;
}

// D49: jornada completa do Organizador — criação de sessão (nasce rascunho,
// D40), confirmação de que os assentos já existem atomicamente, tentativa de
// venda real bloqueada enquanto rascunho (D44), e o caminho de publicação.
// tmdbId 27205 é o mesmo semeado por src/prisma/seed.ts (global-setup já
// rodou o seed) — MoviesService#findOrCacheMovie encontra o Movie já em
// cache e não faz nenhuma chamada de rede real ao TMDb (relevante porque o
// ambiente de teste roda com TMDB_API_KEY dummy, ver .github/workflows/ci.yml).
const SEED_MOVIE_TMDB_ID = 27205;

describe('Jornada completa do Organizador (criar sessão → publicar → venda liberada)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('percorre a jornada inteira: rascunho bloqueia venda, publicação libera', async () => {
    // 1. Login real do organizador.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ORGANIZER_EMAIL, password: SEED_PASSWORD });
    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.user).toMatchObject({ role: 'ORGANIZER' });
    const organizerToken = loginResponse.body.accessToken as string;

    // 2. POST /sessions — nasce published: false (D40). O próximo passo
    // consome session.id.
    const createResponse = await request(app.getHttpServer())
      .post('/sessions')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        tmdbId: SEED_MOVIE_TMDB_ID,
        room: 'Jornada Organizador',
        startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        capacity: 2,
        price: 25,
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.published).toBe(false);
    const sessionId = createResponse.body.id as string;

    // 3. GET /sessions/:id/seats — confirma que os assentos já foram
    // gerados atomicamente na criação, sem passo adicional.
    const seatsResponse = await request(app.getHttpServer()).get(
      `/sessions/${sessionId}/seats`,
    );
    expect(seatsResponse.status).toBe(200);
    const seatEntries = seatsResponse.body as SeatMapItemResponse[];
    expect(seatEntries).toHaveLength(2);
    expect(seatEntries.every((s) => s.status === 'AVAILABLE')).toBe(true);
    const seatId = seatEntries[0].id;

    // 4. Cliente tenta reservar um desses assentos — 403, sessão ainda
    // rascunho (D44). Confirma via banco que zero Reservation foi criada,
    // não só o status HTTP.
    const customerLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER2_EMAIL, password: SEED_PASSWORD });
    expect(customerLoginResponse.status).toBe(201);
    const customerToken = customerLoginResponse.body.accessToken as string;

    const blockedReservation = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId, seatId });
    expect(blockedReservation.status).toBe(403);

    const reservationsBeforePublish = await prisma.reservation.findMany({
      where: { seatId },
    });
    expect(reservationsBeforePublish).toHaveLength(0);

    // 5. PATCH /sessions/:id { published: true } — endpoint de publicação
    // CONFIRMADO existente (updateSessionSchema aceita `published`, ver
    // packages/shared/src/schemas/session.schema.ts), então a jornada segue
    // até o fim em vez de parar aqui.
    const publishResponse = await request(app.getHttpServer())
      .patch(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ published: true });
    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body.published).toBe(true);

    // 6. Repetir a tentativa de reserva — agora 201.
    const allowedReservation = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ sessionId, seatId });
    expect(allowedReservation.status).toBe(201);
    expect(allowedReservation.body).toMatchObject({
      status: 'PENDING',
      seatId,
      sessionId,
    });
  });
});
