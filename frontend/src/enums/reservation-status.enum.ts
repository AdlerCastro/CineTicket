// Espelha ReservationStatus de backend/src/prisma/schema.prisma.
export const ReservationStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReservationStatus =
  (typeof ReservationStatus)[keyof typeof ReservationStatus];
