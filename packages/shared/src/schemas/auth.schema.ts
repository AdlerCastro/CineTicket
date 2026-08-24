import { z } from 'zod';

// Schema mínimo para POST /auth/login — só email+password, propositalmente
// sem reaproveitar userSchema inteiro (que exige name/role, irrelevantes
// para login). password sem min(8): login valida credencial já existente,
// não cria senha nova — a regra de força de senha é responsabilidade do
// cadastro, não deste endpoint.
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
