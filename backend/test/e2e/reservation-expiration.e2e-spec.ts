import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "@/prisma/prisma.service";
import { createTestApp } from "./support/test-app";
import {
  ORGANIZER_EMAIL,
  createDisposableCustomer,
  createDisposableMovie,
  createDisposableSession,
  findSeedUser,
} from "./support/fixtures";

interface SeatMapItemResponse {
  id: string;
  row: string;
  number: number;
  status: string;
}

// D05 (decisions-log.md): reserva PENDING expira em 5 minutos. A
// implementação atual (reservations.service.ts) usa varredura LAZY, não
// job/cron — expireStalePendingForSession roda antes de ler o mapa e antes
// de criar uma reserva nova. Este teste força uma reserva PENDING já
// vencida direto via Prisma (sem esperar 5min de verdade) e confirma que o
// sweep lazy é acionado nos dois pontos de entrada.
describe("Expiração de reserva PENDING (D05)", () => {
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

  it("libera o assento para GET /sessions/:id/seats, permite nova reserva e mantém a reserva antiga como EXPIRED (não deletada, não colide)", async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const seatId = seatIds[0];

    const { user: staleCustomer } = await createDisposableCustomer(
      prisma,
      "stale-owner",
    );
    const staleReservation = await prisma.reservation.create({
      data: {
        sessionId: session.id,
        seatId,
        customerId: staleCustomer.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 60_000), // vencida há 1 minuto
      },
    });

    // 1. O mapa de assentos deve considerar o assento livre.
    const mapResponse = await request(app.getHttpServer()).get(
      `/sessions/${session.id}/seats`,
    );
    expect(mapResponse.status).toBe(200);
    const seatEntries = mapResponse.body as SeatMapItemResponse[];
    const seatEntry = seatEntries.find((s) => s.id === seatId);
    expect(seatEntry?.status).toBe("AVAILABLE");

    // 2. Um novo cliente consegue reservar o mesmo assento com sucesso.
    const { token: newCustomerToken } = await createDisposableCustomer(
      prisma,
      "fresh-buyer",
    );
    const createResponse = await request(app.getHttpServer())
      .post("/reservations")
      .set("Authorization", `Bearer ${newCustomerToken}`)
      .send({ sessionId: session.id, seatId });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe("PENDING");

    // 3. A reserva antiga permanece no banco, marcada EXPIRED — não é
    // deletada e não colide com a nova linha PENDING.
    const staleAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: staleReservation.id },
    });
    expect(staleAfter.status).toBe("EXPIRED");

    const reservationsForSeat = await prisma.reservation.findMany({
      where: { seatId },
      orderBy: { createdAt: "asc" },
    });
    expect(reservationsForSeat).toHaveLength(2);
    expect(reservationsForSeat[0].id).toBe(staleReservation.id);
    expect(reservationsForSeat[0].status).toBe("EXPIRED");
    expect(reservationsForSeat[1].status).toBe("PENDING");
    expect(reservationsForSeat[1].customerId).not.toBe(staleCustomer.id);
  });
});
