// Espelha o model Movie do Prisma, incluído via `include: { movie: true }`
// em GET /sessions e GET /sessions/:id desde D44 — GET /sessions/:id/seats
// deliberadamente não inclui (é DTO de mapa de assentos, não de sessão).
export interface Movie {
  id: string;
  tmdbId: number;
  title: string;
  synopsis: string | null;
  posterUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Espelha o model Session do Prisma (backend/src/prisma/schema.prisma) como
// chega serializado em JSON: `price` é Decimal no banco, mas o Prisma Decimal
// serializa como string via JSON.stringify — nunca number aqui.
export interface Session {
  id: string;
  movieId: string;
  organizerId: string;
  room: string;
  startsAt: string;
  capacity: number;
  price: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  movie: Movie;
}
