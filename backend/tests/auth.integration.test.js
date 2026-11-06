const assert = require('node:assert/strict');
const { before, describe, it } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createAuthenticateRequest } = require('../src/middleware/authenticate-request');
const { createAuthService, hashResetToken } = require('../src/services/auth.service');

const secret = 'integration-test-secret-with-at-least-32-characters';

describe('Fluxos integrados de autenticação', () => {
  let app;
  let user;
  let resetToken;
  let resetTokenExpiresAt;

  before(async () => {
    user = {
      id: 1,
      nome: 'Gerente',
      email: 'manager@school.test',
      passwordHash: await bcrypt.hash('InitialPassword123!', 4),
    };

    const usersRepository = {
      async findByEmail(email) {
        return email === user.email ? { ...user } : null;
      },
      async updatePassword(id, passwordHash) {
        if (id !== user.id) {
          return false;
        }
        user = { ...user, passwordHash };
        return true;
      },
    };
    const passwordResetTokensRepository = {
      async create(userId, tokenHash, expiresAt) {
        assert.equal(userId, user.id);
        storedResetHash = tokenHash;
        resetTokenExpiresAt = expiresAt;
      },
      async resetPassword(tokenHash, passwordHash) {
        if (
          tokenHash !== storedResetHash ||
          !resetTokenExpiresAt ||
          resetTokenExpiresAt <= new Date()
        ) {
          return false;
        }
        await usersRepository.updatePassword(user.id, passwordHash);
        storedResetHash = null;
        return true;
      },
    };
    const authService = createAuthService({
      usersRepository,
      passwordResetTokensRepository,
      mailer: {
        async sendPasswordReset(email, url) {
          assert.equal(email, user.email);
          resetToken = new URL(url).searchParams.get('token');
        },
      },
      hashPassword: (password) => bcrypt.hash(password, 4),
      verifyPassword: (password, passwordHash) => bcrypt.compare(password, passwordHash),
      createAccessToken: (account) =>
        jwt.sign(
          { email: account.email },
          secret,
          {
            algorithm: 'HS256',
            subject: String(account.id),
            issuer: 'reserve-me-api',
            audience: 'reserve-me-client',
            expiresIn: '15m',
          },
        ),
      frontendUrl: 'http://localhost:5500/frontend/pages',
    });

    const roomsRepository = {
      async findAll() {
        return [{ id: 1, nome: 'Sala de teste' }];
      },
    };
    app = createApp({
      authService,
      authenticateRequest: createAuthenticateRequest({ secret }),
      corsOrigin: 'http://localhost:5500',
      roomsRepository,
      reservationsRepository: {},
    });
  });

  let storedResetHash;

  it('faz login, protege os endpoints e permite acesso com o JWT emitido', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'InitialPassword123!' });

    assert.equal(login.status, 200);
    const withoutToken = await request(app).get('/api/salas');
    assert.equal(withoutToken.status, 401);

    const withToken = await request(app)
      .get('/api/salas')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    assert.equal(withToken.status, 200);
    assert.deepEqual(withToken.body, [{ id: 1, nome: 'Sala de teste' }]);
  });

  it('permite preflight CORS somente para a origem configurada', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5500')
      .set('Access-Control-Request-Method', 'POST');

    assert.equal(response.status, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5500');
  });

  it('redefine a senha por e-mail e impede reutilizar o token', async () => {
    const recovery = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });

    assert.equal(recovery.status, 202);
    assert.ok(resetToken);
    assert.equal(storedResetHash, hashResetToken(resetToken));

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'NewSecurePassword123!' });
    assert.equal(reset.status, 200);

    const loginWithOldPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'InitialPassword123!' });
    assert.equal(loginWithOldPassword.status, 401);

    const reuseToken = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'AnotherSecurePassword123!' });
    assert.equal(reuseToken.status, 400);

    const loginWithNewPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewSecurePassword123!' });
    assert.equal(loginWithNewPassword.status, 200);
  });
});
