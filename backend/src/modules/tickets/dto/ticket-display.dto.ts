import { TicketStatus } from '@prisma/client';

// Dado de exibição do ingresso — reaproveita a relação movie já incluída em
// sessions desde D44. `jwt` é o JWT assinado como string; o QR em si nunca é
// gerado no backend (D46/opção A), o frontend renderiza client-side.
export interface TicketDisplayResponse {
  id: string;
  status: TicketStatus;
  jwt: string;
  usedAt: Date | null;
  session: {
    id: string;
    room: string;
    startsAt: Date;
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

// Um dos quatro retornos exatos de project-description.md — ver
// .context/project-state.md para o mapeamento de status HTTP de cada um.
export type TicketValidationResult =
  'VALIDO' | 'INVALIDO' | 'JA_USADO' | 'EVENTO_ERRADO';

export interface ValidateTicketResponse {
  result: TicketValidationResult;
  ticket: TicketDisplayResponse;
}

// D56: histórico de ingressos validados na portaria, filtrado por sessão.
// Sem `session`/`movie` aninhados — a portaria já selecionou a sessão antes
// de validar (D46), então o frontend já sabe qual sessão está exibindo;
// reenviar o objeto inteiro seria dado redundante. Não é ownership (GATE
// consulta por sessão, não por "dono" do Ticket, ao contrário de
// TicketDisplayResponse).
export interface ValidatedTicketResponse {
  id: string;
  status: TicketStatus;
  usedAt: Date | null;
  seat: {
    id: string;
    row: string;
    number: number;
  };
}
