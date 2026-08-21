import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

// Sobe a aplicação Nest real (mesmo AppModule do main.ts) contra o banco de
// teste — sem mocks de Prisma/guards, para que a constraint UNIQUE parcial e
// as transações rodem exatamente como em produção.
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma };
}
