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
          ativo: 1,
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
      ativo: true,
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
          ativo: 1,
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

    assert.deepEqual(await repository.create(reservation), { id: 5, ...reservation, ativo: true });
    assert.deepEqual(calls[0].params, [
      1, '2026-12-10', '09:00', '10:30', 'Ana Silva', 'Reunião', 'Aprovada', true,
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

  it('desativa situação cancelada/finalizada sem apagar o registro', async () => {
    const calls = [];
    const pool = {
      async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('UPDATE')) {
          return [{ affectedRows: 1 }];
        }
        return [[{ id: 5 }]];
      },
    };
    const repository = createReservationsRepository(pool);
    const reservation = {
      sala: 1,
      data: '2026-12-10',
      inicio: '09:00',
      fim: '10:30',
      responsavel: 'Ana Silva',
      finalidade: 'Concluída',
      situacao: 'Finalizada',
    };

    await repository.update(5, reservation);

    assert.match(calls[0].sql, /ativo = IF\(\? IN \('Cancelada', 'Finalizada'\), 0, ativo\)/);
    assert.equal(calls[0].params[7], 'Finalizada');
    assert.equal(calls.some(({ sql }) => sql.startsWith('DELETE')), false);
  });

  it('desativa uma reserva e preserva seu registro', async () => {
    const calls = [];
    const repository = createReservationsRepository({
      async execute(sql, params) {
        calls.push({ sql, params });
        return sql.startsWith('SELECT') ? [[{ id: 5 }]] : [{ affectedRows: 1 }];
      },
    });

    assert.equal(await repository.deactivate(5), true);
    assert.match(calls[0].sql, /^UPDATE reservas SET ativo = 0/);
    assert.deepEqual(calls[0].params, [5]);
    assert.match(calls[1].sql, /^SELECT id FROM reservas/);
    assert.equal(calls.some(({ sql }) => sql.startsWith('DELETE')), false);
  });
});
