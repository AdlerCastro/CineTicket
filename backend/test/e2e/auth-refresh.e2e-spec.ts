import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, TestApp } from './support/test-app';

const DISPOSABLE_PASSWORD = 'senha1234';

// D58: POST /auth/refresh lê o refresh token do cookie httpOnly (nunca do
// body) e valida contra User.refreshTokenHash, que passou a ser escrito de
// verdade em login/register a partir desta tarefa (antes era campo morto —
// nunca gravado). Rotaciona o refresh token a cada uso bem-sucedido.
//
// Usuários descartáveis (não os fixos do seed, ex: CUSTOMER1_EMAIL): estes
// specs fazem asserção sobre o valor exato de refreshTokenHash no banco em
// momentos específicos — com Jest rodando arquivos de spec em paralelo por
// padrão (sem --runInBand configurado), um usuário fixo compartilhado com
// outras specs (ex: customer-journey) que também logam como CUSTOMER1
// criaria uma corrida real entre workers. Usuário descartável por teste
// elimina a contaminação cruzada por completo, independente de paralelismo.
describe('POST /auth/refresh', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await app.close();
  });

  async function createDisposableCustomer(label: string): Promise<string> {
    const email = `qa-refresh-${label}-${randomUUID()}@cineticket.test`;
    createdEmails.push(email);
    const hashedPassword = await bcrypt.hash(DISPOSABLE_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: `QA Refresh ${label}`,
        role: UserRole.CUSTOMER,
      },
    });
    return email;
  }

  function loginAs(email: string): request.Test {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: DISPOSABLE_PASSWORD });
  }

  function extractRefreshCookie(response: request.Response): string {
    const cookies = response.headers['set-cookie'];
    const raw = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = raw.find((c) => c?.startsWith('refreshToken='));
    if (!refreshCookie) {
      throw new Error('refreshToken cookie ausente na resposta de login');
    }
    return refreshCookie.split(';')[0];
  }

  it('login grava refreshTokenHash real no usuário (antes era sempre null)', async () => {
    const email = await createDisposableCustomer('hash-written');
    const response = await loginAs(email);

    expect(response.status).toBe(201);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.refreshTokenHash).not.toBeNull();
  });

  it('refresh válido emite access token novo e funcional numa rota protegida real', async () => {
    const email = await createDisposableCustomer('happy-path');
    const loginResponse = await loginAs(email);

    const refreshCookie = extractRefreshCookie(loginResponse);
    const originalAccessToken = loginResponse.body.accessToken as string;

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshResponse.status).toBe(201);
    expect(typeof refreshResponse.body.accessToken).toBe('string');
    expect(refreshResponse.body.accessToken).not.toBe(originalAccessToken);
    expect(refreshResponse.body.user).toMatchObject({ email });
    expect(refreshResponse.body.user.password).toBeUndefined();
    expect(refreshResponse.body.user.refreshTokenHash).toBeUndefined();

    // O novo access token precisa funcionar de verdade numa rota protegida
    // real — não só ter o shape certo.
    const protectedResponse = await request(app.getHttpServer())
      .get('/tickets/mine')
      .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`);

    expect(protectedResponse.status).toBe(200);
    expect(Array.isArray(protectedResponse.body)).toBe(true);
  });

  it('refresh rotaciona o refresh token — o cookie antigo não funciona mais numa segunda chamada', async () => {
    const email = await createDisposableCustomer('rotation');
    const loginResponse = await loginAs(email);

    const originalRefreshCookie = extractRefreshCookie(loginResponse);

    const firstRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie);
    expect(firstRefresh.status).toBe(201);

    const newRefreshCookie = extractRefreshCookie(firstRefresh);
    expect(newRefreshCookie).not.toBe(originalRefreshCookie);

    // Reusar o cookie antigo (já rotacionado) deve ser rejeitado.
    const reusedOldCookie = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', originalRefreshCookie);
    expect(reusedOldCookie.status).toBe(401);

    // O cookie novo, por sua vez, continua válido.
    const secondRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', newRefreshCookie);
    expect(secondRefresh.status).toBe(201);
  });

  it('sem cookie retorna 401 claro, não 500', async () => {
    const response = await request(app.getHttpServer()).post('/auth/refresh');
    expect(response.status).toBe(401);
    expect(response.body.message).toBeDefined();
  });

  it('cookie com assinatura inválida retorna 401, não 500', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=isso-nao-e-um-jwt-valido');

    expect(response.status).toBe(401);
    expect(response.body.message).toBeDefined();
  });

  it('cookie assinado com secret errado retorna 401, não 500', async () => {
    const forgedToken = jwt.sign(
      { sub: 'algum-id', role: 'CUSTOMER' },
      'secret-errado-de-proposito-com-mais-de-16-chars',
      { expiresIn: '7d' },
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${forgedToken}`);

    expect(response.status).toBe(401);
  });

  it('cookie expirado retorna 401, não 500', async () => {
    const expiredToken = jwt.sign(
      { sub: 'algum-id', role: 'CUSTOMER' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '-1s' },
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${expiredToken}`);

    expect(response.status).toBe(401);
  });

  it('token assinado corretamente mas de usuário inexistente retorna 401', async () => {
    const tokenForGhostUser = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000000', role: 'CUSTOMER' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' },
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${tokenForGhostUser}`);

    expect(response.status).toBe(401);
  });
});

// Escopo expandido durante a mesma tarefa (autorizado explicitamente pelo
// usuário): logout, até aqui, só limpava estado local no frontend — sem
// endpoint no backend, o refreshTokenHash gravado pelo /auth/refresh novo
// continuaria válido por até 7 dias mesmo depois do usuário "sair" pela UI.
// Critério de pronto explícito: refresh usado APÓS logout tem que voltar
// 401 (hash zerado, não bate mais). Mesmo raciocínio de isolamento acima:
// usuário descartável por teste, não o CUSTOMER1_EMAIL fixo do seed.
describe('POST /auth/logout', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await app.close();
  });

  async function createDisposableCustomer(label: string): Promise<string> {
    const email = `qa-logout-${label}-${randomUUID()}@cineticket.test`;
    createdEmails.push(email);
    const hashedPassword = await bcrypt.hash(DISPOSABLE_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: `QA Logout ${label}`,
        role: UserRole.CUSTOMER,
      },
    });
    return email;
  }

  function loginAs(email: string): request.Test {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: DISPOSABLE_PASSWORD });
  }

  function extractRefreshCookie(response: request.Response): string {
    const cookies = response.headers['set-cookie'];
    const raw = Array.isArray(cookies) ? cookies : [cookies];
    const refreshCookie = raw.find((c) => c?.startsWith('refreshToken='));
    if (!refreshCookie) {
      throw new Error('refreshToken cookie ausente na resposta de login');
    }
    return refreshCookie.split(';')[0];
  }

  it('logout zera refreshTokenHash no banco (invalidação server-side real)', async () => {
    const email = await createDisposableCustomer('zeroes-hash');
    const loginResponse = await loginAs(email);
    const refreshCookie = extractRefreshCookie(loginResponse);

    const beforeLogout = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(beforeLogout.refreshTokenHash).not.toBeNull();

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookie);
    expect(logoutResponse.status).toBe(200);

    const afterLogout = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(afterLogout.refreshTokenHash).toBeNull();
  });

  it('logout limpa o cookie httpOnly (Set-Cookie com expiração no passado)', async () => {
    const email = await createDisposableCustomer('clears-cookie');
    const loginResponse = await loginAs(email);
    const refreshCookie = extractRefreshCookie(loginResponse);

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookie);

    const cookies = logoutResponse.headers['set-cookie'];
    const raw = Array.isArray(cookies) ? cookies : [cookies];
    const clearedCookie = raw.find((c) => c?.startsWith('refreshToken='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/refreshToken=;/);
  });

  it('critério de pronto: refresh usado APÓS logout retorna 401 (hash zerado, não bate mais)', async () => {
    const email = await createDisposableCustomer('refresh-after-logout');
    const loginResponse = await loginAs(email);
    const refreshCookie = extractRefreshCookie(loginResponse);

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookie);
    expect(logoutResponse.status).toBe(200);

    // Mesmo cookie de refresh, ainda com assinatura/expiração válidas (7d),
    // mas o hash correspondente no banco já foi zerado pelo logout.
    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshAfterLogout.status).toBe(401);
  });

  it('logout é idempotente: sem cookie nenhum, ainda retorna 200 (não 401/500)', async () => {
    const response = await request(app.getHttpServer()).post('/auth/logout');
    expect(response.status).toBe(200);
  });

  it('logout com cookie de assinatura inválida ainda retorna 200 (limpa o cookie, sem erro)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'refreshToken=isso-nao-e-um-jwt-valido');

    expect(response.status).toBe(200);
  });

  it('login depois de logout volta a funcionar normalmente, sem regressão', async () => {
    const email = await createDisposableCustomer('login-after-logout');
    const loginResponse = await loginAs(email);
    const refreshCookie = extractRefreshCookie(loginResponse);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookie);

    const secondLoginResponse = await loginAs(email);

    expect(secondLoginResponse.status).toBe(201);
    expect(typeof secondLoginResponse.body.accessToken).toBe('string');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.refreshTokenHash).not.toBeNull();
  });
});
