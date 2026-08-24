import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  ORGANIZER_EMAIL,
  createDisposableSession,
  findSeedUser,
} from './support/fixtures';

// D44 (decisions-log.md): GET /sessions e GET /sessions/:id não traziam a
// relação movie (título/pôster), apesar de MoviesModule/findOrCacheMovie
// existir desde o Sprint 2. Este spec cobre o gap.
describe('GET /sessions inclui a relação movie (D44)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    organizerId = organizer.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /sessions traz título e pôster do filme para cada sessão', async () => {
    const movie = await prisma.movie.create({
      data: {
        tmdbId: Math.floor(Math.random() * 1_000_000_000) + 1,
        title: 'Movie Relation Test — List',
        posterUrl: 'https://image.tmdb.org/t/p/w500/relation-test-list.jpg',
      },
    });
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId: movie.id,
      seatCount: 1,
      published: true,
    });

    const response = await request(app.getHttpServer()).get('/sessions');

    expect(response.status).toBe(200);
    const entry = (response.body as Array<{ id: string; movie: unknown }>).find(
      (s) => s.id === session.id,
    );
    expect(entry).toBeDefined();
    expect(entry?.movie).toMatchObject({
      id: movie.id,
      title: 'Movie Relation Test — List',
      posterUrl: 'https://image.tmdb.org/t/p/w500/relation-test-list.jpg',
    });
  });

  it('GET /sessions/:id traz título e pôster do filme', async () => {
    const movie = await prisma.movie.create({
      data: {
        tmdbId: Math.floor(Math.random() * 1_000_000_000) + 1,
        title: 'Movie Relation Test — Detail',
        posterUrl: 'https://image.tmdb.org/t/p/w500/relation-test-detail.jpg',
      },
    });
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId: movie.id,
      seatCount: 1,
      published: true,
    });

    const response = await request(app.getHttpServer()).get(
      `/sessions/${session.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.movie).toMatchObject({
      id: movie.id,
      title: 'Movie Relation Test — Detail',
      posterUrl: 'https://image.tmdb.org/t/p/w500/relation-test-detail.jpg',
    });
  });

  it('GET /sessions/:id/seats não inclui dados de filme — mapa de assentos é escopo separado da sessão/filme', async () => {
    const movie = await prisma.movie.create({
      data: {
        tmdbId: Math.floor(Math.random() * 1_000_000_000) + 1,
        title: 'Movie Relation Test — Seats',
      },
    });
    const { session } = await createDisposableSession(prisma, {
      organizerId,
      movieId: movie.id,
      seatCount: 1,
      published: true,
    });

    const response = await request(app.getHttpServer()).get(
      `/sessions/${session.id}/seats`,
    );

    expect(response.status).toBe(200);
    const seatEntries = response.body as Array<Record<string, unknown>>;
    expect(seatEntries.length).toBeGreaterThan(0);
    seatEntries.forEach((seat) => {
      expect(seat).not.toHaveProperty('movie');
      expect(Object.keys(seat).sort()).toEqual(
        ['id', 'number', 'row', 'status'].sort(),
      );
    });
  });
});
