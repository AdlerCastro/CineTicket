import { User } from '@prisma/client';
import { LoginInput } from '@cineticket/shared';

export type AuthenticatedUser = Omit<User, 'password' | 'refreshTokenHash'>;

export type AuthenticateUserRequest = LoginInput;

export interface AuthenticateUserResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
