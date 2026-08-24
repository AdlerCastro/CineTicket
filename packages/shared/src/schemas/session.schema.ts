import { z } from 'zod';

// Espelha o CreateSessionDto do backend (organizador cria sessão a partir
// do catálogo TMDb). `tmdbId` chega do resultado de busca no TMDb — o
// backend resolve/cria o Movie local (cache) a partir dele.
export const createSessionSchema = z.object({
  tmdbId: z.number().int().positive(),
  room: z.string().min(1),
  startsAt: z.coerce.date(),
  capacity: z.number().int().positive(),
  price: z.number().positive(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// `tmdbId`/`capacity` fora daqui de propósito: mudar depois quebraria a
// correspondência Session<->Seat[] já gerada na criação.
export const updateSessionSchema = z.object({
  room: z.string().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  price: z.number().positive().optional(),
  published: z.boolean().optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
