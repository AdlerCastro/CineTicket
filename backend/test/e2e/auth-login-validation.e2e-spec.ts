import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app';
import { CUSTOMER1_EMAIL, SEED_PASSWORD } from './support/fixtures';

// Pendência desde o Sprint 2 (decisions-log.md D38): POST /auth/login não
// tinha ZodValidationPipe — payload malformado (ex: email sem @, campo
// faltando) caía direto no AuthService, que só falharia mais tarde de forma
// menos clara. Este spec cobre a validação aplicada e confirma que o
// caminho feliz (login válido) não regrediu.
describe('POST /auth/login — validação via ZodValidationPipe', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('email malformado retorna 400 com erro de validação claro', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nao-e-um-email', password: SEED_PASSWORD });

    expect(response.status).toBe(400);
    // ZodValidationPipe lança BadRequestException(result.error.flatten()) —
    // o objeto flatten() (fieldErrors/formErrors) vira o corpo da resposta
    // diretamente, sem wrapper `message` (mesmo padrão já usado nos outros
    // endpoints que aplicam o pipe, ex: sessions/reservations).
    expect(response.body.fieldErrors).toBeDefined();
    expect(response.body.fieldErrors.email).toBeDefined();
  });

  it('password ausente retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL });

    expect(response.status).toBe(400);
  });

  it('email ausente retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ password: SEED_PASSWORD });

    expect(response.status).toBe(400);
  });

  it('payload completamente vazio retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({});

    expect(response.status).toBe(400);
  });

  it('body com tipos errados (número em vez de string) retorna 400, não 500', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL, password: 12345678 });

    expect(response.status).toBe(400);
  });

  it('login válido continua funcionando sem regressão', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL, password: SEED_PASSWORD });

    expect(response.status).toBe(201);
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).toMatchObject({ email: CUSTOMER1_EMAIL });
  });

  it('credenciais inválidas com payload bem formado continua 401 (não vira 400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: CUSTOMER1_EMAIL, password: 'senha-errada' });

    expect(response.status).toBe(401);
  });
});
