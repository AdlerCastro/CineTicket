import { z } from 'zod';

// Espelha o ValidateTicketDto do backend. `token` é o JWT lido do QR (câmera
// ou digitado manualmente) — mesma string de entrada nos dois casos, sem
// distinção pro backend. `sessionId` é a sessão que a tela de portaria está
// checando no momento (pressuposto documentado em .context/project-state.md).
export const validateTicketSchema = z.object({
  token: z.string().min(1),
  sessionId: z.string().uuid(),
});

export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;
