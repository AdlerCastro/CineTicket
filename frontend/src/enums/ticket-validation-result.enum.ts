// Espelha TicketValidationResult de
// backend/src/modules/tickets/dto/ticket-display.dto.ts — os 4 retornos
// exatos de POST /tickets/validate (project-description.md).
export const TicketValidationResult = {
  VALIDO: 'VALIDO',
  INVALIDO: 'INVALIDO',
  JA_USADO: 'JA_USADO',
  EVENTO_ERRADO: 'EVENTO_ERRADO',
} as const;

export type TicketValidationResult =
  (typeof TicketValidationResult)[keyof typeof TicketValidationResult];
