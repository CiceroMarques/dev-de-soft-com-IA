const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

describe('API de autenticação', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      roomsRepository: {},
      reservationsRepository: {},
      authenticateRequest: (req, res, next) => next(),
      authService: {
        async login(email, password) {
          if (email === 'staff@school.test' && password === 'ValidPassword123!') {
            return {
              accessToken: 'signed.jwt.token',
              expiresIn: 900,
              user: { id: 1, nome: 'Staff User', email },
            };
          }

          const error = new Error('E-mail ou senha inválidos.');
          error.statusCode = 401;
          throw error;
        },
        async requestPasswordReset() {
          return {
            message: 'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.',
          };
        },
        async resetPassword(token, password) {
          if (token !== 'a'.repeat(64) || password !== 'NewSecurePass123!') {
            const error = new Error('Token inválido, expirado ou já utilizado.');
            error.statusCode = 400;
            throw error;
          }
          return { message: 'Senha redefinida com sucesso.' };
        },
      },
    });
  });

  it('autentica com e-mail e senha e retorna um token de acesso', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@school.test', password: 'ValidPassword123!' });

    assert.equal(response.status, 200);
    assert.equal(response.body.accessToken, 'signed.jwt.token');
    assert.equal(response.body.expiresIn, 900);
    assert.deepEqual(response.body.user, {
      id: 1,
      nome: 'Staff User',
      email: 'staff@school.test',
    });
  });

  it('retorna erro genérico para credenciais inválidas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@school.test', password: 'wrong-password' });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'E-mail ou senha inválidos.');
  });

  it('rejeita campos ausentes no login', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'staff@school.test' });

    assert.equal(response.status, 400);
    assert.ok(Array.isArray(response.body.errors));
  });

  it('limita tentativas de login por endereço IP', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'unknown@school.test', password: 'wrong-password' });
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@school.test', password: 'wrong-password' });

    assert.equal(response.status, 429);
    assert.equal(response.body.error, 'Muitas tentativas. Tente novamente mais tarde.');
  });

  it('responde de forma genérica ao solicitar recuperação de senha', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'staff@school.test' });

    assert.equal(response.status, 202);
    assert.match(response.body.message, /Se o e-mail estiver cadastrado/);
  });

  it('rejeita e-mail malformado na recuperação', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    assert.equal(response.status, 400);
  });

  it('redefine a senha usando token de uso único', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'NewSecurePass123!' });

    assert.equal(response.status, 200);
    assert.equal(response.body.message, 'Senha redefinida com sucesso.');
  });

  it('rejeita senha nova que não atende à política mínima', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), password: 'short' });

    assert.equal(response.status, 400);
    assert.ok(Array.isArray(response.body.errors));
  });
});
