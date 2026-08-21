import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRole as Role } from "@prisma/client";
import { AuthenticatedRequest } from "../types/authenticated-request.type";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // rota sem @Roles = pública
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return requiredRoles.includes(user?.role);
  }
}
