import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// IDs fixos para tornar o seed idempotente sem precisar de um índice único
// próprio em Session — rodar o script de novo só faz upsert em cima disto.
const SEED_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const SEED_MOVIE_TMDB_ID = 27205; // "A Origem" (Inception) no TMDb
const SEAT_ROWS = ['A', 'B'];
const SEATS_PER_ROW = 5;
const SEED_PASSWORD = 'senha123';

async function upsertUser(email: string, name: string, role: UserRole) {
  const password = await bcrypt.hash(SEED_PASSWORD, 10);

  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password, name, role },
  });
}

function nextFridayAt20h(): Date {
  const date = new Date();
  const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  date.setHours(20, 0, 0, 0);
  return date;
}

async function main() {
  const organizer = await upsertUser(
    'organizador@cineticket.dev',
    'Organizador Demo',
    UserRole.ORGANIZER,
  );
  const customer1 = await upsertUser(
    'cliente1@cineticket.dev',
    'Cliente Um',
    UserRole.CUSTOMER,
  );
  const customer2 = await upsertUser(
    'cliente2@cineticket.dev',
    'Cliente Dois',
    UserRole.CUSTOMER,
  );
  const gate = await upsertUser(
    'portaria@cineticket.dev',
    'Portaria Demo',
    UserRole.GATE,
  );

  const movie = await prisma.movie.upsert({
    where: { tmdbId: SEED_MOVIE_TMDB_ID },
    update: {},
    create: {
      tmdbId: SEED_MOVIE_TMDB_ID,
      title: 'A Origem',
      synopsis:
        'Um ladrão que rouba segredos corporativos através do uso da tecnologia de compartilhamento de sonhos é encarregado da tarefa inversa de plantar uma ideia na mente de um CEO.',
      posterUrl:
        'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    },
  });

  const session = await prisma.session.upsert({
    where: { id: SEED_SESSION_ID },
    update: {},
    create: {
      id: SEED_SESSION_ID,
      movieId: movie.id,
      organizerId: organizer.id,
      room: 'Sala 1',
      startsAt: nextFridayAt20h(),
      capacity: SEAT_ROWS.length * SEATS_PER_ROW,
      price: 32.5,
      published: true,
    },
  });

  for (const row of SEAT_ROWS) {
    for (let number = 1; number <= SEATS_PER_ROW; number += 1) {
      await prisma.seat.upsert({
        where: { sessionId_row_number: { sessionId: session.id, row, number } },
        update: {},
        create: { sessionId: session.id, row, number },
      });
    }
  }

  console.log('✅ Seed concluído:');
  console.log(`   organizador: ${organizer.email} / ${SEED_PASSWORD}`);
  console.log(`   cliente 1:   ${customer1.email} / ${SEED_PASSWORD}`);
  console.log(`   cliente 2:   ${customer2.email} / ${SEED_PASSWORD}`);
  console.log(`   portaria:    ${gate.email} / ${SEED_PASSWORD}`);
  console.log(
    `   sessão publicada: ${session.id} (${SEAT_ROWS.length * SEATS_PER_ROW} assentos disponíveis)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed falhou:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
