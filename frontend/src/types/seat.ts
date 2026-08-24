import type { SeatStatus } from '@/enums/seat-status.enum';

// Espelha SeatMapItem de backend/src/modules/seats/dto/seat-map-item.dto.ts.
export interface SeatMapItem {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
}
