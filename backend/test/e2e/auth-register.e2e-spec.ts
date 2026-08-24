import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { createTestApp, TestApp } from './support/test-app';
import { CUSTOMER1_EMAIL, SEED_PASSWORD } from './support/fixtures';

// D43: POST /auth/register nunca tinha sido implementado — frontend já
// consumia o endpoint desde o Sprint 3, tratando o 404 como erro visível.
// Cobre o critério de segurança não-negociável (role do payload nunca é
// confiado, backend força CUSTOMER sempre), e-mail duplicado (409, não 500)
// e validação via ZodValidationPipe (mesmo padrão de auth-login-validation).
describe('POST /auth/register', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const createdEmails: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  function uniqueEmail(label: string): string {
    const email = `qa-register-${label}-${randomUUID()}@cineticket.test`;
    createdEmails.push(email);
    return email;
  }

  it('payload válido cria usuário CUSTOMER e já retorna tokens (login automático)', async () => {
    const email = uniqueEmail('happy-path');

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'senha1234',
        name: 'QA Register',
        role: UserRole.CUSTOMER,
      });

    expect(response.status).toBe(201);
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).toMatchObject({
      email,
      role: UserRole.CUSTOMER,
    });
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.refreshTokenHash).toBeUndefined();

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(String(cookies)).toContain('refreshToken=');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe(UserRole.CUSTOMER);
  });

  it('payload malicioso com role ORGANIZER é ignorado — usuário criado como CUSTOMER mesmo assim', async () => {
    const email = uniqueEmail('malicious-organizer');

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'senha1234',
        name: 'QA Malicious',
        role: UserRole.ORGANIZER,
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe(UserRole.CUSTOMER);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.role).toBe(UserRole.CUSTOMER);
  });

  it('payload malicioso com role GATE é ignorado — usuário criado como CUSTOMER mesmo assim', async () => {
    const email = uniqueEmail('malicious-gate');

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'senha1234',
        name: 'QA Malicious Gate',
        role: UserRole.GATE,
      });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe(UserRole.CUSTOMER);
  });

  it('e-mail já cadastrado retorna 409, não 500', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: CUSTOMER1_EMAIL,
        password: SEED_PASSWORD,
        name: 'Duplicado',
        role: UserRole.CUSTOMER,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBeDefined();
  });

  it('senha curta (< 8 caracteres) retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('short-password'),
        password: '123',
        name: 'QA Short Password',
        role: UserRole.CUSTOMER,
      });

    expect(response.status).toBe(400);
    expect(response.body.fieldErrors?.password).toBeDefined();
  });

  it('email malformado retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'nao-e-um-email',
        password: 'senha1234',
        name: 'QA Bad Email',
        role: UserRole.CUSTOMER,
      });

    expect(response.status).toBe(400);
    expect(response.body.fieldErrors?.email).toBeDefined();
  });

  it('campo name ausente retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('missing-name'),
        password: 'senha1234',
        role: UserRole.CUSTOMER,
      });

    expect(response.status).toBe(400);
  });

  it('payload completamente vazio retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({});

    expect(response.status).toBe(400);
  });
});
