import { randomUUID } from 'crypto';
import { AddressInfo } from 'net';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { Server } from 'socket.io';
import { PrismaService } from '@/prisma/prisma.service';
import { SeatsGateway } from '@/modules/gateway/seats.gateway';
import { createTestApp } from './support/test-app';
import {
  ORGANIZER_EMAIL,
  createDisposableCustomer,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
} from './support/fixtures';

// N mínimo pedido para o teste de broadcast/estabilidade (ver CLAUDE.md da
// tarefa): volume equivalente ao já usado em
// reservations-concurrency.e2e-spec.ts, agora aplicado a conexões WS.
const LOAD_TEST_CLIENTS = 12;

interface SeatUpdateEvent {
  seatId: string;
  status: string;
}

interface RecordedSeatUpdate extends SeatUpdateEvent {
  t: number;
}

// Acesso ao campo `server` (private) da gateway só para inspecionar, em
// teste, quantos sockets a room realmente tem depois de uma desconexão —
// nenhuma API nova é exposta em produção por causa disso. `unknown` em vez de
// `any` (proibido por CLAUDE.md/eslint) porque o cast é só pra descrever o
// formato runtime que o teste depende, não pra desligar checagem de tipo.
interface GatewayInternals {
  server: Server;
}

// Mesmo motivo do cast acima: engine.io-client não expõe publicamente o
// websocket cru nos tipos, mas é o único jeito de simular uma queda de
// conexão real (terminate, sem handshake de close) em vez de um
// `socket.disconnect()` gracioso.
interface ClientWithRawSocket {
  io: {
    engine: {
      close: () => void;
      transport?: {
        ws?: { terminate?: () => void; close?: () => void };
      };
    };
  };
}

function abruptlyDisconnect(client: ClientSocket): void {
  const engine = (client as unknown as ClientWithRawSocket).io.engine;
  const ws = engine.transport?.ws;
  if (ws?.terminate) {
    ws.terminate();
  } else if (ws?.close) {
    ws.close();
  } else {
    engine.close();
  }
}

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

  // Escuta persistente (não `.once`) — precisamos contar TODOS os eventos que
  // chegam num cliente ao longo do teste, pra detectar perda (nenhum) e
  // duplicata (mais de um por etapa), não só o primeiro.
  function recordSeatUpdates(client: ClientSocket): RecordedSeatUpdate[] {
    const events: RecordedSeatUpdate[] = [];
    client.on('seat:update', (payload: SeatUpdateEvent) => {
      events.push({ ...payload, t: Date.now() });
    });
    return events;
  }

  async function waitForLength(
    events: RecordedSeatUpdate[],
    length: number,
    timeoutMs: number,
  ): Promise<void> {
    const start = Date.now();
    while (events.length < length) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `timeout: esperava ${length} evento(s), chegaram ${events.length} após ${timeoutMs}ms`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  // Dispara `action`, espera todos os `recorders` receberem exatamente 1
  // evento novo, confere o payload e devolve a pior latência (não a média)
  // entre o disparo e o último cliente notificado. Uma folga extra depois do
  // último recebido confirma que nenhum cliente recebeu duplicata.
  async function broadcastStepAndMeasure(params: {
    recorders: RecordedSeatUpdate[][];
    seatId: string;
    expectedStatus: string;
    action: () => Promise<void>;
  }): Promise<number> {
    const checkpoints = params.recorders.map((events) => events.length);
    const t0 = Date.now();

    await params.action();

    await Promise.all(
      params.recorders.map((events, i) =>
        waitForLength(events, checkpoints[i] + 1, 10000),
      ),
    );

    const worst = Math.max(
      ...params.recorders.map((events, i) => events[checkpoints[i]].t - t0),
    );

    // folga de decantação: se algo emitir em duplicata com pequeno atraso,
    // aparece aqui antes da asserção de comprimento abaixo.
    await new Promise((resolve) => setTimeout(resolve, 200));

    params.recorders.forEach((events, i) => {
      expect(events.length).toBe(checkpoints[i] + 1);
      expect(events[checkpoints[i]]).toMatchObject({
        seatId: params.seatId,
        status: params.expectedStatus,
      });
    });

    return worst;
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

  it('cliente B recebe seat:update em tempo real quando cliente A reserva via REST, sem polling', async () => {
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
  }, 15000);

  it('subscribe em sessão inexistente e em sessão published:false são recusados com a mesma mensagem genérica', async () => {
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
  }, 15000);

  it(`broadcast para ${LOAD_TEST_CLIENTS} clientes simultâneos na mesma room, 3 ciclos reserva→expira→reserva, sem perda/duplicata`, async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
      published: true,
    });
    const seatId = seatIds[0];
    const { token } = await createDisposableCustomer(
      prisma,
      'gateway-broadcast',
    );

    const clients = Array.from({ length: LOAD_TEST_CLIENTS }, () =>
      connectClient(),
    );
    const recorders = clients.map((client) => recordSeatUpdates(client));

    clients.forEach((client) =>
      client.emit('join:session', { sessionId: session.id }),
    );
    await Promise.all(
      clients.map((client) => waitForEvent(client, 'join:ack')),
    );

    const stepLatencies: number[] = [];
    let reservationId = '';

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      const reserveWorst = await broadcastStepAndMeasure({
        recorders,
        seatId,
        expectedStatus: 'PENDING',
        action: async () => {
          const response = await request(app.getHttpServer())
            .post('/reservations')
            .set('Authorization', `Bearer ${token}`)
            .send({ sessionId: session.id, seatId });
          expect(response.status).toBe(201);
          reservationId = response.body.id as string;
        },
      });
      stepLatencies.push(reserveWorst);

      // Força a expiração igual ao spec de expiração já existente — sem
      // job novo, só reaproveita o sweep lazy que já existe.
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const expireWorst = await broadcastStepAndMeasure({
        recorders,
        seatId,
        expectedStatus: 'AVAILABLE',
        action: async () => {
          const response = await request(app.getHttpServer()).get(
            `/sessions/${session.id}/seats`,
          );
          expect(response.status).toBe(200);
        },
      });
      stepLatencies.push(expireWorst);
    }

    const worstOverall = Math.max(...stepLatencies);

    // Dado concreto pedido pelo relatório de estabilidade do marco D08.
    console.log(
      `[gateway-broadcast] N=${LOAD_TEST_CLIENTS} clientes, pior latência por etapa (ms): ${stepLatencies.join(', ')} — pior geral: ${worstOverall}ms`,
    );

    expect(worstOverall).toBeLessThan(10000);
  }, 60000);

  it('desconexão abrupta de metade dos clientes: sobreviventes continuam recebendo eventos e a room não fica com entrada fantasma', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
      published: true,
    });
    const seatId = seatIds[0];
    const { token } = await createDisposableCustomer(prisma, 'gateway-abrupt');

    const clients = Array.from({ length: LOAD_TEST_CLIENTS }, () =>
      connectClient(),
    );
    const recorders = clients.map((client) => recordSeatUpdates(client));

    clients.forEach((client) =>
      client.emit('join:session', { sessionId: session.id }),
    );
    await Promise.all(
      clients.map((client) => waitForEvent(client, 'join:ack')),
    );

    const roomName = `session:${session.id}`;
    // `server` é private em SeatsGateway — o cast via `unknown` é
    // estruturalmente idêntico ao tipo real (por isso o eslint tenta marcar
    // como "desnecessário"), mas é o que faz o TS aceitar o acesso fora da
    // classe. Sem o disable, `eslint --fix` remove o cast e quebra o build.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const gatewayServer = (app.get(SeatsGateway) as unknown as GatewayInternals)
      .server;

    const initialRoomSize = (await gatewayServer.in(roomName).fetchSockets())
      .length;
    expect(initialRoomSize).toBe(LOAD_TEST_CLIENTS);

    const half = LOAD_TEST_CLIENTS / 2;
    const toKill = clients.slice(0, half);
    const survivors = clients.slice(half);
    const survivorRecorders = recorders.slice(half);

    // Fecha o transporte cru (terminate/close no WS), não `.disconnect()`
    // — simula queda de conexão sem o handshake gracioso do socket.io.
    toKill.forEach((client) => abruptlyDisconnect(client));

    // A limpeza da room é assíncrona (o servidor precisa detectar o
    // fechamento do transporte) — poll até estabilizar em vez de sleep fixo.
    const pollStart = Date.now();
    let roomSizeAfterKill = initialRoomSize;
    while (Date.now() - pollStart < 10000) {
      roomSizeAfterKill = (await gatewayServer.in(roomName).fetchSockets())
        .length;
      if (roomSizeAfterKill === survivors.length) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const checkpoints = survivorRecorders.map((events) => events.length);
    const t0 = Date.now();
    const response = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: session.id, seatId });
    expect(response.status).toBe(201);

    await Promise.all(
      survivorRecorders.map((events, i) =>
        waitForLength(events, checkpoints[i] + 1, 10000),
      ),
    );
    const latencies = survivorRecorders.map(
      (events, i) => events[checkpoints[i]].t - t0,
    );

    // Dado concreto pedido pelo relatório de estabilidade do marco D08.
    console.log(
      `[gateway-abrupt-disconnect] sobreviventes=${survivors.length}/${LOAD_TEST_CLIENTS}, room pós-limpeza=${roomSizeAfterKill} (esperado ${survivors.length}), pior latência pós-desconexão=${Math.max(...latencies)}ms`,
    );

    survivorRecorders.forEach((events, i) => {
      expect(events[checkpoints[i]]).toMatchObject({
        seatId,
        status: 'PENDING',
      });
    });

    // Nenhuma entrada fantasma: o tamanho da room reportado pelo servidor
    // tem que cair para exatamente os sobreviventes, não ficar preso no
    // total original.
    expect(roomSizeAfterKill).toBe(survivors.length);
  }, 30000);
});
