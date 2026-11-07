const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createAuthService } = require('../src/services/auth.service');

function createAuthFixture() {
  const users = new Map([
    [1, { id: 1, nome: 'Staff User', email: 'staff@school.test', passwordHash: 'stored-hash' }],
  ]);
  const tokens = new Map();
  const sentEmails = [];

  const usersRepository = {
    async findByEmail(email) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    async updatePassword(id, passwordHash) {
      const user = users.get(id);
      if (!user) {
        return false;
      }
      users.set(id, { ...user, passwordHash });
      return true;
    },
  };

  const passwordResetTokensRepository = {
    async create(userId, tokenHash, expiresAt) {
      tokens.set(tokenHash, { userId, expiresAt });
    },
    async resetPassword(tokenHash, passwordHash) {
      const tokenRecord = tokens.get(tokenHash);
      if (!tokenRecord || tokenRecord.expiresAt <= new Date()) {
        return false;
      }
      await usersRepository.updatePassword(tokenRecord.userId, passwordHash);
      tokens.delete(tokenHash);
      return true;
    },
  };

  const service = createAuthService({
    usersRepository,
    passwordResetTokensRepository,
    mailer: {
      async sendPasswordReset(email, url) {
        sentEmails.push({ email, url });
      },
    },
    hashPassword: async (password) => `hashed:${password}`,
    verifyPassword: async (password, passwordHash) =>
      passwordHash === 'stored-hash' && password === 'ValidPassword123!',
    createAccessToken: (user) => `token-for-${user.id}`,
    frontendUrl: 'http://localhost:5500/frontend/pages',
    resetTokenTtlMinutes: 30,
  });

  return { service, users, tokens, sentEmails };
}

describe('Serviço de autenticação', () => {
  it('normaliza o e-mail no login e não expõe o hash da senha', async () => {
    const { service } = createAuthFixture();

    assert.deepEqual(await service.login(' STAFF@SCHOOL.TEST ', 'ValidPassword123!'), {
      accessToken: 'token-for-1',
      expiresIn: 900,
      user: { id: 1, nome: 'Staff User', email: 'staff@school.test' },
    });
  });

  it('usa a mesma falha para e-mail inexistente e senha incorreta', async () => {
    const { service } = createAuthFixture();

    await assert.rejects(service.login('unknown@school.test', 'wrong'), {
      statusCode: 401,
      message: 'E-mail ou senha inválidos.',
    });
    await assert.rejects(service.login('staff@school.test', 'wrong'), {
      statusCode: 401,
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('gera link de recuperação somente para conta existente, mantendo resposta uniforme', async () => {
    const { service, sentEmails } = createAuthFixture();
    const registered = await service.requestPasswordReset('staff@school.test');
    const unknown = await service.requestPasswordReset('unknown@school.test');

    assert.deepEqual(registered, unknown);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].url, /^http:\/\/localhost:5500\/frontend\/pages\/redefinir-senha\.html\?token=/);
  });

  it('retorna 503 sem consultar contas quando SMTP não está configurado', async () => {
    const service = createAuthService({
      usersRepository: {
        async findByEmail() {
          throw new Error('O repositório não deve ser consultado sem SMTP.');
        },
      },
      passwordResetTokensRepository: {},
      mailer: { isConfigured: false },
      hashPassword: async (value) => value,
      verifyPassword: async () => false,
      createAccessToken: () => '',
      frontendUrl: 'http://localhost:5500/frontend/pages',
    });

    await assert.rejects(service.requestPasswordReset('person@example.test'), {
      statusCode: 503,
      message: 'Recuperação de senha não está configurada neste ambiente.',
    });
  });

  it('atualiza a senha e invalida o token após a redefinição', async () => {
    const { service, users, sentEmails } = createAuthFixture();
    await service.requestPasswordReset('staff@school.test');
    const token = new URL(sentEmails[0].url).searchParams.get('token');

    assert.deepEqual(await service.resetPassword(token, 'NewSecurePass123!'), {
      message: 'Senha redefinida com sucesso.',
    });
    assert.equal(users.get(1).passwordHash, 'hashed:NewSecurePass123!');
    await assert.rejects(service.resetPassword(token, 'AnotherSecurePass123!'), {
      statusCode: 400,
    });
  });
});
