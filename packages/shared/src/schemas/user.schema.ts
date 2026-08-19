import { z } from 'zod';

export const userRoleSchema = z.enum(['ORGANIZER', 'CUSTOMER', 'GATE']);

export type UserRole = z.infer<typeof userRoleSchema>;

// Espelha o CreateUserDto do backend (auth/registro) — nunca inclui
// campos sensíveis derivados (id, refreshTokenHash) nem campos calculados.
export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: userRoleSchema,
});

export type UserInput = z.infer<typeof userSchema>;
