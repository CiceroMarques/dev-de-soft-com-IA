const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { cabeNaSala } = require('../src/services/room-capacity');

const salas = [
  { id: 1, nome: 'Sala A', capacidade: 30 },
  { id: 2, nome: 'Sala B', capacidade: 20 },
];

describe('Função cabeNaSala', () => {
  it('retorna false quando a turma é maior que a capacidade da sala', () => {
    assert.equal(cabeNaSala(31, 1, salas), false);
  });

  it('retorna true quando a turma é igual à capacidade da sala', () => {
    assert.equal(cabeNaSala(30, 1, salas), true);
  });

  it('retorna true quando a turma é menor que a capacidade da sala', () => {
    assert.equal(cabeNaSala(18, 1, salas), true);
  });

  it('retorna false quando a sala não existe ou o identificador é inválido', () => {
    assert.equal(cabeNaSala(10, 999, salas), false);
    assert.equal(cabeNaSala(10, 'inválido', salas), false);
    assert.equal(cabeNaSala(10, 0, salas), false);
  });

  it('aceita identificador numérico recebido como texto', () => {
    assert.equal(cabeNaSala(20, '2', salas), true);
  });

  it('retorna false para quantidade inválida ou lista de salas inválida', () => {
    assert.equal(cabeNaSala(-1, 1, salas), false);
    assert.equal(cabeNaSala(10.5, 1, salas), false);
    assert.equal(cabeNaSala(10, 1, null), false);
  });
});
