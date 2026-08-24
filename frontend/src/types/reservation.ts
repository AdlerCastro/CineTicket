import type { ReservationStatus } from '@/enums/reservation-status.enum';

// Espelha o model Reservation do Prisma, formato de retorno de POST /reservations
// e POST /payments. `ticketId` só existe na resposta de POST /payments com
// decision APPROVE (Ticket criado na mesma transação) — ausente em DECLINE e
// sempre ausente na resposta de POST /reservations (mirror de
// backend/src/modules/payments/dto/payment-response.dto.ts, achado do
// Frontend Agent no Sprint 4: sem isso não havia como navegar até o ingresso
// recém-pago, ver .context/project-state.md).
export interface Reservation {
  id: string;
  sessionId: string;
  seatId: string;
  customerId: string;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ticketId?: string;
}
