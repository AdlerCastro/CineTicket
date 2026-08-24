import type { UserRole } from '@cineticket/shared';

// Espelha AuthenticatedUser de backend/src/modules/auth/dto/login.dto.ts
// (User sem password/refreshTokenHash).
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
