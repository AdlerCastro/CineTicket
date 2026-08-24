import type { TicketStatus } from '@/enums/ticket-status.enum';
import type { TicketValidationResult } from '@/enums/ticket-validation-result.enum';

// Espelha TicketDisplayResponse de
// backend/src/modules/tickets/dto/ticket-display.dto.ts. `jwt` é o QR em
// forma de string — nunca é gerada imagem no backend (D46).
export interface TicketDisplay {
  id: string;
  status: TicketStatus;
  jwt: string;
  usedAt: string | null;
  session: {
    id: string;
    room: string;
    startsAt: string;
    movie: {
      id: string;
      title: string;
      posterUrl: string | null;
    };
  };
  seat: {
    id: string;
    row: string;
    number: number;
  };
}

// Corpo de sucesso de POST /tickets/validate (200, VALIDO).
export interface ValidateTicketResponse {
  result: typeof TicketValidationResult.VALIDO;
  ticket: TicketDisplay;
}

// Corpo dos 3 retornos de erro (400/409/422) — nunca inclui `ticket`, só
// `result`+`message` (ver tickets.service.ts#validate no backend).
export interface ValidateTicketErrorBody {
  result: Exclude<TicketValidationResult, typeof TicketValidationResult.VALIDO>;
  message: string;
}
