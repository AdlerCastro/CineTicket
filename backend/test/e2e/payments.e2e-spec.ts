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

interface SeatMapItemResponse {
  id: string;
  status: string;
}

describe('Pagamento simulado (POST /payments)', () => {
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

  it('DECLINE cancela a reserva e libera o assento imediatamente para outro cliente', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const seatId = seatIds[0];
    const { token: buyerToken } = await createDisposableCustomer(
      prisma,
      'decline-buyer',
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ sessionId: session.id, seatId });
    expect(reservationResponse.status).toBe(201);
    const reservationId = reservationResponse.body.id as string;

    const declineResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ reservationId, decision: 'DECLINE' });
    expect(declineResponse.status).toBe(201);
    expect(declineResponse.body.status).toBe('CANCELLED');
    expect(declineResponse.body.ticketId).toBeUndefined();

    const seatMapResponse = await request(app.getHttpServer()).get(
      `/sessions/${session.id}/seats`,
    );
    const seatEntries = seatMapResponse.body as SeatMapItemResponse[];
    expect(seatEntries.find((s) => s.id === seatId)?.status).toBe(
      'AVAILABLE',
    );

    // Outro cliente consegue reservar o mesmo assento normalmente.
    const { token: otherBuyerToken } = await createDisposableCustomer(
      prisma,
      'decline-second-buyer',
    );
    const secondReservation = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${otherBuyerToken}`)
      .send({ sessionId: session.id, seatId });
    expect(secondReservation.status).toBe(201);
    expect(secondReservation.body.status).toBe('PENDING');

    // Nenhum Ticket é criado no caminho de recusa.
    const ticket = await prisma.ticket.findUnique({
      where: { reservationId },
    });
    expect(ticket).toBeNull();
  });

  it('APPROVE marca a reserva como PAGA e gera um Ticket VALID', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: buyerToken } = await createDisposableCustomer(
      prisma,
      'approve-buyer',
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ sessionId: session.id, seatId: seatIds[0] });
    const reservationId = reservationResponse.body.id as string;

    const approveResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(approveResponse.status).toBe(201);
    expect(approveResponse.body.status).toBe('PAID');
    expect(approveResponse.body.ticketId).toEqual(expect.any(String));

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { reservationId },
    });
    expect(ticket.status).toBe('VALID');
    expect(ticket.code).toEqual(expect.any(String));
    // Confirma que o ticketId retornado na resposta de /payments é
    // exatamente o Ticket criado na mesma transação, não um outro id.
    expect(approveResponse.body.ticketId).toBe(ticket.id);

    const ticketResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(ticketResponse.status).toBe(200);
    expect(ticketResponse.body.jwt).toBe(ticket.code);
    expect(ticketResponse.body.session.movie.id).toBeDefined();

    // Outro cliente não pode ver o ingresso alheio.
    const { token: strangerToken } = await createDisposableCustomer(
      prisma,
      'approve-stranger',
    );
    const strangerResponse = await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(strangerResponse.status).toBe(403);
  });

  it('rejeita pagamento de reserva já expirada, sem marcar como PAGA', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: buyerToken, user: buyer } = await createDisposableCustomer(
      prisma,
      'expired-buyer',
    );

    const staleReservation = await prisma.reservation.create({
      data: {
        sessionId: session.id,
        seatId: seatIds[0],
        customerId: buyer.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ reservationId: staleReservation.id, decision: 'APPROVE' });
    expect(paymentResponse.status).toBe(409);

    const reservationAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: staleReservation.id },
    });
    expect(reservationAfter.status).toBe('EXPIRED');

    const ticket = await prisma.ticket.findUnique({
      where: { reservationId: staleReservation.id },
    });
    expect(ticket).toBeNull();
  });

  it('recusa pagamento de reserva alheia (só o dono pode pagar/recusar)', async () => {
    const { session, seatIds } = await createDisposableSession(prisma, {
      organizerId,
      movieId,
      seatCount: 1,
    });
    const { token: ownerToken } = await createDisposableCustomer(
      prisma,
      'ownership-owner',
    );
    const { token: strangerToken } = await createDisposableCustomer(
      prisma,
      'ownership-stranger',
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionId: session.id, seatId: seatIds[0] });
    const reservationId = reservationResponse.body.id as string;

    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ reservationId, decision: 'APPROVE' });
    expect(response.status).toBe(403);

    const reservationAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
    });
    expect(reservationAfter.status).toBe('PENDING');
  });
});
