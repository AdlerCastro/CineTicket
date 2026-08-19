import { z } from 'zod';

// Espelha o CreateReservationDto do backend (cliente reserva um assento).
// `customerId` nunca vem do corpo da requisição — é extraído do JWT de
// autenticação no backend, nunca confiado a partir do payload do cliente.
export const createReservationSchema = z.object({
  sessionId: z.string().uuid(),
  seatId: z.string().uuid(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
