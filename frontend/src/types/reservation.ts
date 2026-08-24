import type { ReservationStatus } from '@/enums/reservation-status.enum';

// Espelha o model Reservation do Prisma, formato de retorno de POST /reservations.
export interface Reservation {
  id: string;
  sessionId: string;
  seatId: string;
  customerId: string;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
