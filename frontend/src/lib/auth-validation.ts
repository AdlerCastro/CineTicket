import { z } from 'zod';

// Sem schema de login em packages/shared (só userSchema, de registro) e
// `/auth/login` no backend também não usa ZodValidationPipe hoje (pendência
// já registrada em .context/project-state.md) — schema local só para UX do
// formulário, mesmo padrão de fallback local já usado no Gateway (D-consistente).
export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

export type LoginInput = z.infer<typeof loginSchema>;
