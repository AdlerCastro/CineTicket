import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { Movie, PrismaClient, Session, User, UserRole } from "@prisma/client";

// Credenciais fixas semeadas por src/prisma/seed.ts (rodado no global setup,
// ver support/global-setup.js) — reaproveitadas só para os 4 usuários fixos,
// nunca para a sessão/assentos que o seed também cria (ver CLAUDE.md da
// tarefa: a sessão do seed não deve ser reaproveitada pelos specs de QA).
export const SEED_PASSWORD = "senha123";
export const ORGANIZER_EMAIL = "organizador@cineticket.dev";
export const CUSTOMER1_EMAIL = "cliente1@cineticket.dev";
export const CUSTOMER2_EMAIL = "cliente2@cineticket.dev";
export const GATE_EMAIL = "portaria@cineticket.dev";

export function signAccessToken(userId: string, role: UserRole): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_ACCESS_SECRET não definido no ambiente de teste (ver CI/instruções de execução local).",
    );
  }
  // Mesmo formato de payload assinado por AuthService.login — sub/role — para
  // que JwtStrategy.validate() aceite o token como se viesse do /auth/login.
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: "15m" });
}

export async function findSeedUser(
  prisma: PrismaClient,
  email: string,
): Promise<User> {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

// Cliente descartável criado direto via Prisma (fora do seed) para dar mais
// "corredores" simultâneos ao teste de concorrência do que os 2 clientes
// fixos permitiriam sozinhos. A senha nunca é usada para login real — o
// token é assinado diretamente (signAccessToken), então o hash não precisa
// ser válido.
export async function createDisposableCustomer(
  prisma: PrismaClient,
  label: string,
): Promise<{ user: User; token: string }> {
  const user = await prisma.user.create({
    data: {
      email: `qa-${label}-${randomUUID()}@cineticket.test`,
      password: "not-used-token-is-signed-directly",
      name: `QA Customer ${label}`,
      role: UserRole.CUSTOMER,
    },
  });
  return { user, token: signAccessToken(user.id, user.role) };
}

export async function createDisposableMovie(
  prisma: PrismaClient,
): Promise<Movie> {
  return prisma.movie.create({
    data: {
      tmdbId: Math.floor(Math.random() * 1_000_000_000) + 1,
      title: "QA Test Movie",
    },
  });
}

export async function createDisposableSession(
  prisma: PrismaClient,
  opts: { organizerId: string; movieId: string; seatCount?: number },
): Promise<{ session: Session; seatIds: string[] }> {
  const seatCount = opts.seatCount ?? 1;

  const session = await prisma.session.create({
    data: {
      movieId: opts.movieId,
      organizerId: opts.organizerId,
      room: "QA Room",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      capacity: seatCount,
      price: 20,
      published: true,
    },
  });

  const seatIds: string[] = [];
  for (let number = 1; number <= seatCount; number += 1) {
    const seat = await prisma.seat.create({
      data: { sessionId: session.id, row: "Q", number },
    });
    seatIds.push(seat.id);
  }

  return { session, seatIds };
}
