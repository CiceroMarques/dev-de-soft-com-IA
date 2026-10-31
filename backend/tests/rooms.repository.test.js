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

    assert.deepEqual(await repository.create(room), { id: 7, ...room });
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
});
