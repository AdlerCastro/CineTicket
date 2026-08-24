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
}
