import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  ORGANIZER_EMAIL,
  createDisposableMovie,
  createDisposableOrganizer,
  createDisposableSession,
  findSeedUser,
  signAccessToken,
} from './support/fixtures';

interface SessionListItem {
  id: string;
  organizerId: string;
}

// Risco #6 (decisions-log.md D40/D44): os 3 endpoints REST de sessions não
// filtravam published/dono — uma sessão rascunho (published:false) era
// legível por qualquer um que soubesse o id, inclusive listada pra qualquer
// um em GET /sessions. Este spec cobre a regra: published:true continua 100%
// público; published:false só é visível pro organizador dono — anônimo e
// outro organizador recebem 404 em GET /sessions/:id (não 403, mesmo
// raciocínio de "não vazar informação" já usado pelo Gateway em D40) e a
// sessão simplesmente não aparece em GET /sessions. GET /sessions/:id/seats
// segue a mesma regra da sessão correspondente.
describe('Filtro published/dono nos 3 endpoints REST de sessions (Risco #6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let ownerToken: string;
  let otherOrganizerId: string;
  let otherOrganizerToken: string;
  let movieId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const owner = await findSeedUser(prisma, ORGANIZER_EMAIL);
    ownerId = owner.id;
    // Token assinado diretamente (mesmo padrão de createDisposableCustomer/
    // createDisposableOrganizer) — este spec testa a regra de visibilidade,
    // não o fluxo de login em si (isso já é coberto pelas jornadas D49).
    ownerToken = signAccessToken(owner.id, owner.role);

    const other = await createDisposableOrganizer(prisma, 'visibility-other');
    otherOrganizerId = other.user.id;
    otherOrganizerToken = other.token;

    const movie = await createDisposableMovie(prisma);
    movieId = movie.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /sessions', () => {
    it('rascunho aparece só pro dono; anônimo e outro organizador não veem; publicada aparece pra todos', async () => {
      const { session: draft } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: false,
      });
      const { session: otherDraft } = await createDisposableSession(prisma, {
        organizerId: otherOrganizerId,
        movieId,
        seatCount: 1,
        published: false,
      });
      const { session: published } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: true,
      });

      const anonymousList = await request(app.getHttpServer()).get(
        '/sessions',
      );
      expect(anonymousList.status).toBe(200);
      const anonymousIds = (anonymousList.body as SessionListItem[]).map(
        (s) => s.id,
      );
      expect(anonymousIds).not.toContain(draft.id);
      expect(anonymousIds).not.toContain(otherDraft.id);
      expect(anonymousIds).toContain(published.id);

      const ownerList = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerList.status).toBe(200);
      const ownerIds = (ownerList.body as SessionListItem[]).map((s) => s.id);
      expect(ownerIds).toContain(draft.id);
      expect(ownerIds).not.toContain(otherDraft.id);
      expect(ownerIds).toContain(published.id);

      const otherList = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${otherOrganizerToken}`);
      expect(otherList.status).toBe(200);
      const otherIds = (otherList.body as SessionListItem[]).map((s) => s.id);
      expect(otherIds).not.toContain(draft.id);
      expect(otherIds).toContain(otherDraft.id);
      expect(otherIds).toContain(published.id);
    });
  });

  describe('GET /sessions/:id', () => {
    it('rascunho: 404 anônimo, 404 outro organizador, 200 dono', async () => {
      const { session: draft } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: false,
      });

      const anonymousResponse = await request(app.getHttpServer()).get(
        `/sessions/${draft.id}`,
      );
      expect(anonymousResponse.status).toBe(404);

      const otherResponse = await request(app.getHttpServer())
        .get(`/sessions/${draft.id}`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`);
      expect(otherResponse.status).toBe(404);

      const ownerResponse = await request(app.getHttpServer())
        .get(`/sessions/${draft.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerResponse.status).toBe(200);
      expect(ownerResponse.body.id).toBe(draft.id);
    });

    it('publicada: 200 pra todo mundo, sem regressão', async () => {
      const { session: published } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: true,
      });

      const anonymousResponse = await request(app.getHttpServer()).get(
        `/sessions/${published.id}`,
      );
      expect(anonymousResponse.status).toBe(200);

      const otherResponse = await request(app.getHttpServer())
        .get(`/sessions/${published.id}`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`);
      expect(otherResponse.status).toBe(200);

      const ownerResponse = await request(app.getHttpServer())
        .get(`/sessions/${published.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerResponse.status).toBe(200);
    });
  });

  describe('GET /sessions/:id/seats', () => {
    it('rascunho: 404 anônimo, 404 outro organizador, 200 dono (mesma regra da sessão)', async () => {
      const { session: draft } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: false,
      });

      const anonymousResponse = await request(app.getHttpServer()).get(
        `/sessions/${draft.id}/seats`,
      );
      expect(anonymousResponse.status).toBe(404);

      const otherResponse = await request(app.getHttpServer())
        .get(`/sessions/${draft.id}/seats`)
        .set('Authorization', `Bearer ${otherOrganizerToken}`);
      expect(otherResponse.status).toBe(404);

      const ownerResponse = await request(app.getHttpServer())
        .get(`/sessions/${draft.id}/seats`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerResponse.status).toBe(200);
      expect(Array.isArray(ownerResponse.body)).toBe(true);
      expect(ownerResponse.body).toHaveLength(1);
    });

    it('publicada: 200 pra todo mundo, sem regressão', async () => {
      const { session: published } = await createDisposableSession(prisma, {
        organizerId: ownerId,
        movieId,
        seatCount: 1,
        published: true,
      });

      const anonymousResponse = await request(app.getHttpServer()).get(
        `/sessions/${published.id}/seats`,
      );
      expect(anonymousResponse.status).toBe(200);
      expect(anonymousResponse.body).toHaveLength(1);
    });
  });

  it('sessão inexistente continua 404 pra todo mundo (sem regressão)', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';

    const anonymousResponse = await request(app.getHttpServer()).get(
      `/sessions/${missingId}`,
    );
    expect(anonymousResponse.status).toBe(404);

    const ownerResponse = await request(app.getHttpServer())
      .get(`/sessions/${missingId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerResponse.status).toBe(404);
  });
});
