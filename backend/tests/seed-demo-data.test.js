const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  DEMO_RESERVATIONS,
  DEMO_ROOMS,
  futureDate,
} = require('../scripts/seed-demo-data');

describe('Dados de demonstração', () => {
  it('define três salas com os campos aceitos pela API', () => {
    assert.equal(DEMO_ROOMS.length, 3);
    for (const room of DEMO_ROOMS) {
      assert.equal(typeof room.nome, 'string');
      assert.equal(Number.isInteger(room.andar), true);
      assert.equal(Number.isInteger(room.capacidade), true);
      assert.ok(Array.isArray(room.recursos));
    }
  });

  it('define exatamente cinco reservas com situações permitidas', () => {
    assert.equal(DEMO_RESERVATIONS.length, 5);
    for (const reservation of DEMO_RESERVATIONS) {
      assert.ok(DEMO_ROOMS.some((room) => room.nome === reservation.room));
      assert.ok(['Pendente', 'Aprovada', 'Cancelada', 'Finalizada'].includes(reservation.situacao));
    }
  });

  it('gera datas futuras em formato SQL e avança o número de dias solicitado', () => {
    const tomorrow = futureDate(1);
    const later = futureDate(3);

    assert.match(tomorrow, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Date.parse(`${later}T00:00:00Z`) - Date.parse(`${tomorrow}T00:00:00Z`), 2 * 24 * 60 * 60 * 1000);
    assert.ok(Date.parse(`${tomorrow}T00:00:00Z`) > Date.now() - 24 * 60 * 60 * 1000);
  });
});
