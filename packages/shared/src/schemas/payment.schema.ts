import { z } from 'zod';

// Espelha o ProcessPaymentDto do backend. D04: decisão vem do cliente via
// botão explícito na tela — nunca aleatória, nunca decidida pelo backend.
export const processPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  decision: z.enum(['APPROVE', 'DECLINE']),
});

export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
