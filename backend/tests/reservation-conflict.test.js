const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { existeConflito } = require('../src/services/reservation-conflict');

const existingReservation = {
  id: 1,
  sala: 1,
  data: '2026-12-10',
  inicio: '09:00',
  fim: '10:30',
  situacao: 'Aprovada',
  ativo: true,
};

function createReservation(overrides = {}) {
  return {
    sala: 1,
    data: '2026-12-10',
    inicio: '10:00',
    fim: '11:00',
    situacao: 'Pendente',
    ...overrides,
  };
}

describe('Função existeConflito', () => {
  it('detecta sobreposição de horário na mesma sala e data', () => {
    assert.equal(existeConflito(createReservation(), [existingReservation]), true);
  });

  it('não detecta conflito quando os horários são diferentes ou apenas encostam', () => {
    assert.equal(
      existeConflito(createReservation({ inicio: '10:30', fim: '11:30' }), [existingReservation]),
      false,
    );
    assert.equal(
      existeConflito(createReservation({ inicio: '07:00', fim: '09:00' }), [existingReservation]),
      false,
    );
  });

  it('não detecta conflito quando as salas são diferentes', () => {
    assert.equal(
      existeConflito(createReservation({ sala: 2 }), [existingReservation]),
      false,
    );
  });

  it('não detecta conflito quando as datas são diferentes', () => {
    assert.equal(
      existeConflito(createReservation({ data: '2026-12-11' }), [existingReservation]),
      false,
    );
  });

  it('ignora reservas canceladas e desativadas', () => {
    const canceled = { ...existingReservation, situacao: 'Cancelada', ativo: false };
    const inactive = { ...existingReservation, situacao: 'Aprovada', ativo: false };

    assert.equal(existeConflito(createReservation(), [canceled, inactive]), false);
  });

  it('ignora reservas finalizadas', () => {
    const finished = { ...existingReservation, situacao: 'Finalizada', ativo: false };

    assert.equal(existeConflito(createReservation(), [finished]), false);
  });

  it('ignora a própria reserva durante uma atualização', () => {
    assert.equal(
      existeConflito(createReservation({ id: existingReservation.id }), [existingReservation]),
      false,
    );
  });

  it('não bloqueia ao registrar uma nova reserva já cancelada ou finalizada', () => {
    assert.equal(
      existeConflito(createReservation({ situacao: 'Cancelada' }), [existingReservation]),
      false,
    );
    assert.equal(
      existeConflito(createReservation({ situacao: 'Finalizada' }), [existingReservation]),
      false,
    );
  });
});
