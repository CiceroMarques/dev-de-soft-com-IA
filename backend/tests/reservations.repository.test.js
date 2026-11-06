const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createReservationsRepository } = require('../src/repositories/reservations.repository');

describe('Repositório MySQL de reservas', () => {
  it('mapeia os campos e normaliza data e horários retornados pelo banco', async () => {
    const repository = createReservationsRepository({
      async execute() {
        return [[{
          id: 8,
          sala: 3,
          data: '2026-12-10',
          inicio: '09:00:00',
          fim: '10:30:00',
          responsavel: 'Ana Silva',
          finalidade: 'Reunião de equipe',
          situacao: 'Pendente',
        }]];
      },
    });

    assert.deepEqual(await repository.findAll(), [{
      id: 8,
      sala: 3,
      data: '2026-12-10',
      inicio: '09:00',
      fim: '10:30',
      responsavel: 'Ana Silva',
      finalidade: 'Reunião de equipe',
      situacao: 'Pendente',
    }]);
  });

  it('persiste todos os campos e busca a reserva criada', async () => {
    const calls = [];
    const pool = {
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('INSERT')) {
          return [{ insertId: 5 }];
        }

        return [[{
          id: 5,
          sala: 1,
          data: '2026-12-10',
          inicio: '09:00:00',
          fim: '10:30:00',
          responsavel: 'Ana Silva',
          finalidade: 'Reunião',
          situacao: 'Aprovada',
        }]];
      },
    };
    const repository = createReservationsRepository(pool);
    const reservation = {
      sala: 1,
      data: '2026-12-10',
      inicio: '09:00',
      fim: '10:30',
      responsavel: 'Ana Silva',
      finalidade: 'Reunião',
      situacao: 'Aprovada',
    };

    assert.deepEqual(await repository.create(reservation), { id: 5, ...reservation });
    assert.deepEqual(calls[0].params, [
      1, '2026-12-10', '09:00', '10:30', 'Ana Silva', 'Reunião', 'Aprovada',
    ]);
  });

  it('retorna null quando a reserva não existe', async () => {
    const repository = createReservationsRepository({
      async execute() {
        return [[]];
      },
    });

    assert.equal(await repository.findById(404), null);
  });
});
