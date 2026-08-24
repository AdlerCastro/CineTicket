import { Reservation } from '@prisma/client';

// Achado do Frontend Agent (Sprint 4): POST /payments não expunha nenhuma
// referência ao Ticket criado na mesma transação de aprovação, então não
// havia forma legítima de navegar até o ingresso recém-pago. `ticketId` (não
// o Ticket completo) porque o frontend só precisa do id para montar a rota
// GET /tickets/:id — já existente e já dona da checagem de ownership; expor
// o Ticket inteiro aqui duplicaria o mesmo formato de resposta em dois
// endpoints sem necessidade. Ausente em DECLINE, onde nenhum Ticket existe.
export interface PaymentResponse extends Reservation {
  ticketId?: string;
}
