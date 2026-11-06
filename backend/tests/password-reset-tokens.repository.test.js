const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createPasswordResetTokensRepository } = require('../src/repositories/password-reset-tokens.repository');

function createConnection(rows = []) {
  const calls = [];
  return {
    calls,
    async beginTransaction() {
      calls.push('begin');
    },
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('SELECT id, user_id')) {
        return [rows];
      }
      if (sql.startsWith('UPDATE usuarios')) {
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() {
      calls.push('commit');
    },
    async rollback() {
      calls.push('rollback');
    },
    release() {
      calls.push('release');
    },
  };
}

describe('Repositório de tokens de redefinição', () => {
  it('consome o token e atualiza senha na mesma transação', async () => {
    const connection = createConnection([{ id: 8, user_id: 4 }]);
    const repository = createPasswordResetTokensRepository({
      async getConnection() {
        return connection;
      },
    });

    assert.equal(await repository.resetPassword('token-hash', 'bcrypt-hash'), true);
    assert.equal(connection.calls[0], 'begin');
    assert.ok(connection.calls.some((call) => call.sql?.startsWith('UPDATE usuarios')));
    assert.ok(connection.calls.some((call) =>
      call.sql?.includes('UPDATE password_reset_tokens SET consumed_at'),
    ));
    assert.ok(connection.calls.includes('commit'));
    assert.ok(connection.calls.includes('release'));
  });

  it('não atualiza senha quando o token não existe ou expirou', async () => {
    const connection = createConnection([]);
    const repository = createPasswordResetTokensRepository({
      async getConnection() {
        return connection;
      },
    });

    assert.equal(await repository.resetPassword('unknown-hash', 'bcrypt-hash'), false);
    assert.ok(connection.calls.includes('rollback'));
    assert.ok(!connection.calls.some((call) => call.sql?.startsWith('UPDATE usuarios')));
    assert.ok(connection.calls.includes('release'));
  });

  it('armazena apenas o hash do token e remove tokens anteriores dentro de transação', async () => {
    const connection = createConnection();
    const repository = createPasswordResetTokensRepository({
      async getConnection() {
        return connection;
      },
    });
    const expiresAt = new Date('2026-12-01T10:00:00.000Z');

    await repository.create(3, 'sha256-hash', expiresAt);
    assert.ok(connection.calls[1].sql.includes('DELETE FROM password_reset_tokens'));
    assert.ok(connection.calls[2].sql.includes('INSERT INTO password_reset_tokens'));
    assert.deepEqual(connection.calls[2].params, [3, 'sha256-hash', expiresAt]);
    assert.ok(connection.calls.includes('commit'));
    assert.ok(connection.calls.includes('release'));
  });
});
