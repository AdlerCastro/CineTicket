// Espelha SeatStatus de backend/src/modules/seats/dto/seat-map-item.dto.ts —
// mesmos valores usados no payload seat:update do Gateway (D40).
export const SeatStatus = {
  AVAILABLE: 'AVAILABLE',
  PENDING: 'PENDING',
  PAID: 'PAID',
} as const;

export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];
