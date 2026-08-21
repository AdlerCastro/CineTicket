import { User } from "@prisma/client";

export type AuthenticatedUser = Omit<User, "password" | "refreshTokenHash">;

export interface AuthenticateUserRequest {
  email: string;
  password: string;
}

export interface AuthenticateUserResponse {
  accessToken: string;
  user: AuthenticatedUser;
}
