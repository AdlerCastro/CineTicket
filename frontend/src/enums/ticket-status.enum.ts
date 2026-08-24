// Espelha TicketStatus de backend/src/prisma/schema.prisma.
export const TicketStatus = {
  VALID: 'VALID',
  USED: 'USED',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];
