export type SeatStatus = 'AVAILABLE' | 'PENDING' | 'PAID';

export interface SeatMapItem {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
}
