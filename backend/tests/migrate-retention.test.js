const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { applyRetentionMigration } = require('../scripts/migrate-retention');

describe('Migração de retenção de dados', () => {
  it('adiciona colunas de atividade, amplia situações e desativa reservas encerradas', async () => {
    const calls = [];
    const connection = {
      async execute(sql, params = []) {
        calls.push({ sql, params });
        if (sql.includes('information_schema.columns')) {
          return [[{ total: 0 }]];
        }
        return [{ affectedRows: 0 }];
      },
    };

    await applyRetentionMigration(connection);

    assert.equal(calls.filter(({ sql }) => sql.startsWith('ALTER TABLE') && sql.includes('ADD COLUMN')).length, 2);
    assert.ok(calls.some(({ sql }) => sql.includes("'Finalizada'")));
    assert.ok(calls.some(({ sql }) => sql.startsWith('UPDATE reservas SET ativo = 0')));
    assert.equal(calls.some(({ sql }) => sql.startsWith('DELETE')), false);
  });

  it('não adiciona colunas duplicadas quando executada novamente', async () => {
    const calls = [];
    const connection = {
      async execute(sql, params = []) {
        calls.push({ sql, params });
        if (sql.includes('information_schema.columns')) {
          return [[{ total: 1 }]];
        }
        return [{ affectedRows: 0 }];
      },
    };

    await applyRetentionMigration(connection);

    assert.equal(calls.filter(({ sql }) => sql.startsWith('ALTER TABLE') && sql.includes('ADD COLUMN')).length, 0);
    assert.ok(calls.some(({ sql }) => sql.includes("'Finalizada'")));
  });
});
