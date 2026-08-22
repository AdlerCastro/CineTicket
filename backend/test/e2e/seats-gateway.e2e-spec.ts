import { randomUUID } from 'crypto';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { PrismaService } from '@/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import {
  ORGANIZER_EMAIL,
  createDisposableCustomer,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
} from './support/fixtures';

// D40: Gateway WebSocket do mapa de assentos — room por sessionId, recusa de
// subscribe em sessão inexistente/não-publicada (mesma mensagem genérica) e
// emissão de evento de atualização em tempo real quando uma Reservation é
// criada, sem exigir polling do cliente.
describe('WebSocket Gateway (assentos em tempo real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerId: string;
  let movieId: string;
  let baseUrl: string;

  const sockets: ClientSocket[] = [];

  function connectClient(): ClientSocket {
    const client = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(client);
    return client;
  }

  function waitForEvent<T>(client: ClientSocket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timeout aguardando evento "${event}"`));
      }, 5000);
      client.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    const organizer = await findSeedUser(prisma, ORGANIZER_EMAIL);
    organizerId = organizer.id;
    const movie = await createDisposableMovie(prisma);
    movieId = movie.id;
  });

  afterEach(() => {
    sockets.forEach((socket) => socket.disconnect());
    sockets.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    'cliente B recebe seat:update em tempo real quando cliente A reserva via REST, sem polling',
    async () => {
      const { session, seatIds } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
        published: true,
      });
      const seatId = seatIds[0];
      const { token } = await createDisposableCustomer(prisma, 'gateway-a');

      const clientA = connectClient();
      const clientB = connectClient();

      clientA.emit('join:session', { sessionId: session.id });
      clientB.emit('join:session', { sessionId: session.id });

      await Promise.all([
        waitForEvent(clientA, 'join:ack'),
        waitForEvent(clientB, 'join:ack'),
      ]);

      const seatUpdatePromise = waitForEvent<{
        seatId: string;
        status: string;
      }>(clientB, 'seat:update');

      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({ sessionId: session.id, seatId });

      expect(response.status).toBe(201);

      const update = await seatUpdatePromise;
      expect(update).toEqual({ seatId, status: 'PENDING' });
    },
    15000,
  );

  it(
    'subscribe em sessão inexistente e em sessão published:false são recusados com a mesma mensagem genérica',
    async () => {
      const { session: draftSession } = await createDisposableSession(prisma, {
        organizerId,
        movieId,
        seatCount: 1,
        published: false,
      });

      const clientDraft = connectClient();
      const clientMissing = connectClient();

      clientDraft.emit('join:session', { sessionId: draftSession.id });
      clientMissing.emit('join:session', { sessionId: randomUUID() });

      const [draftError, missingError] = await Promise.all([
        waitForEvent<{ message: string }>(clientDraft, 'join:error'),
        waitForEvent<{ message: string }>(clientMissing, 'join:error'),
      ]);

      expect(draftError.message).toEqual(missingError.message);
      expect(draftError.message.length).toBeGreaterThan(0);
    },
    15000,
  );
});
