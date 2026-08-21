import { Request } from 'express';
import { UserRole as Role } from '@prisma/client';

export interface AuthenticatedUserRole {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUserRole;
}
