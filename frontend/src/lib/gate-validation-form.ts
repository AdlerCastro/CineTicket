import { z } from 'zod';

// Sem schema compartilhado pra isso em packages/shared (só o formato de
// envio, validateTicketSchema, que já exige sessionId junto) — schema
// local só para UX do campo manual, mesmo padrão de lib/auth-validation.ts.
export const manualTicketTokenSchema = z.object({
  token: z.string().min(1, 'Cole ou digite o código do ingresso'),
});

export type ManualTicketTokenInput = z.infer<typeof manualTicketTokenSchema>;
