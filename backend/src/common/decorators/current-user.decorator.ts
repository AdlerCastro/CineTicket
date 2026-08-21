import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  AuthenticatedRequest,
  AuthenticatedUserRole,
} from "../types/authenticated-request.type";

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUserRole => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
