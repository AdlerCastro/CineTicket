import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Risco #6: GET /sessions, GET /sessions/:id, GET /sessions/:id/seats
// continuam públicos (D32 — navegação de visitante sem login) mas precisam
// saber QUEM é o usuário quando um JWT válido vier, para aplicar o filtro
// published/dono. `handleRequest` normalmente lança 401 quando não há
// usuário (comportamento de JwtAuthGuard) — aqui é sobrescrito para nunca
// lançar: sem token, token malformado ou expirado, todos caem no mesmo
// caminho (`request.user = null`, tratado como anônimo), em vez de bloquear
// a rota.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user || null;
  }
}
