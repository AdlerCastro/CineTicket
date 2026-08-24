// D54: shape mínimo para o frontend reconciliar o ReservationPanel com uma
// Reservation PENDING já existente ao revisitar /sessions/[id] — sem os
// detalhes de sessão/assento completos que GET /tickets/:id expõe, porque
// aqui o painel já está na própria tela da sessão.
export interface ActiveReservationResponse {
  reservationId: string;
  seatId: string;
  expiresAt: Date;
}
