const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createRoomsRepository } = require('../src/repositories/rooms.repository');

describe('Repositório MySQL de salas', () => {
  it('converte recursos JSON ao consultar salas', async () => {
    const pool = {
      async execute() {
        return [[{
          id: 3,
          nome: 'Laboratório',
          andar: 1,
          capacidade: 24,
          recursos: '["Computadores"]',
          ativo: 1,
        }]];
      },
    };
    const repository = createRoomsRepository(pool);

    assert.deepEqual(await repository.findAll(), [{
      id: 3,
      nome: 'Laboratório',
      andar: 1,
      capacidade: 24,
      recursos: ['Computadores'],
      ativo: true,
    }]);
  });

  it('salva os recursos serializados e retorna a sala criada', async () => {
    const calls = [];
    const pool = {
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('INSERT')) {
          return [{ insertId: 7 }];
        }

        return [[{
          id: 7,
          nome: 'Sala de aula',
          andar: 0,
          capacidade: 30,
          recursos: ['Projetor'],
          ativo: 1,
        }]];
      },
    };
    const repository = createRoomsRepository(pool);
    const room = {
      nome: 'Sala de aula',
      andar: 0,
      capacidade: 30,
      recursos: ['Projetor'],
    };

    assert.deepEqual(await repository.create(room), { id: 7, ...room, ativo: true });
    assert.deepEqual(calls[0].params, ['Sala de aula', 0, 30, '["Projetor"]']);
  });

  it('retorna null quando uma sala não existe', async () => {
    const repository = createRoomsRepository({
      async execute() {
        return [[]];
      },
    });

    assert.equal(await repository.findById(404), null);
  });

  it('desativa uma sala por atualização e confirma que o registro permanece', async () => {
    const calls = [];
    const repository = createRoomsRepository({
      async execute(sql, params) {
        calls.push({ sql, params });
        return sql.startsWith('SELECT') ? [[{ id: 7 }]] : [{ affectedRows: 1 }];
      },
    });

    assert.equal(await repository.deactivate(7), true);
    assert.match(calls[0].sql, /^UPDATE salas SET ativo = 0/);
    assert.deepEqual(calls[0].params, [7]);
    assert.match(calls[1].sql, /^SELECT id FROM salas/);
    assert.equal(calls.some(({ sql }) => sql.startsWith('DELETE')), false);
  });
});
