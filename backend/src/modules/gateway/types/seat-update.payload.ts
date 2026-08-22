// Espelha SeatStatus (seats/dto/seat-map-item.dto.ts) sem importar do módulo
// seats — o Gateway só precisa dos valores possíveis de status em tempo real,
// não da leitura de mapa em si.
export type SeatRealtimeStatus = 'AVAILABLE' | 'PENDING' | 'PAID';

export interface SeatUpdatePayload {
  seatId: string;
  status: SeatRealtimeStatus;
}

export interface JoinSessionPayload {
  sessionId: string;
}

export interface JoinErrorPayload {
  message: string;
}

export interface JoinAckPayload {
  sessionId: string;
}
