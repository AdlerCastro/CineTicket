import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserRole } from '../types/authenticated-request.type';

// Par de OptionalJwtAuthGuard: request.user é o usuário autenticado ou
// `null` (anônimo) — nunca undefined/lança erro, ao contrário de
// CurrentUser (que assume JwtAuthGuard obrigatório já ter garantido o user).
export const OptionalCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserRole | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUserRole | null }>();
    return request.user ?? null;
  },
);
