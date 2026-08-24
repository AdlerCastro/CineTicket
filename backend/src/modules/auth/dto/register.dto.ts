import { UserInput } from '@cineticket/shared';
import { AuthenticateUserResponse } from './login.dto';

export type RegisterUserRequest = UserInput;

// Registro bem-sucedido já retorna tokens (login automático) — mesmo
// formato de resposta do login, reaproveitado em vez de inventar um
// fluxo de confirmação separado.
export type RegisterUserResponse = AuthenticateUserResponse;
