const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

const validRoom = {
  nome: 'Sala de reuniões',
  andar: 2,
  capacidade: 12,
  recursos: ['Projetor', 'Quadro branco'],
};

function createInMemoryRepository() {
  const rooms = new Map();
  let nextId = 1;

  return {
    async findAll() {
      return [...rooms.values()];
    },
    async findById(id) {
      return rooms.get(id) ?? null;
    },
    async create(room) {
      const createdRoom = { id: nextId++, ...room };
      rooms.set(createdRoom.id, createdRoom);
      return createdRoom;
    },
    async update(id, room) {
      if (!rooms.has(id)) {
        return null;
      }

      const updatedRoom = { id, ...room };
      rooms.set(id, updatedRoom);
      return updatedRoom;
    },
    async delete(id) {
      return rooms.delete(id);
    },
  };
}

describe('API de salas', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      roomsRepository: createInMemoryRepository(),
      reservationsRepository: {
        async findAll() { return []; },
        async findById() { return null; },
        async create(reservation) { return reservation; },
        async update() { return null; },
        async delete() { return false; },
      },
    });
  });

  it('lista todas as salas', async () => {
    const response = await request(app).get('/api/salas');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });

  it('cria uma sala e a retorna com identificador', async () => {
    const response = await request(app).post('/api/salas').send(validRoom);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { id: 1, ...validRoom });
  });

  it('busca uma sala pelo identificador', async () => {
    await request(app).post('/api/salas').send(validRoom);
    const response = await request(app).get('/api/salas/1');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 1, ...validRoom });
  });

  it('retorna 404 ao buscar uma sala inexistente', async () => {
    const response = await request(app).get('/api/salas/999');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada.');
  });

  it('atualiza todos os dados de uma sala', async () => {
    await request(app).post('/api/salas').send(validRoom);
    const updatedRoom = {
      nome: 'Sala multimídia',
      andar: 3,
      capacidade: 20,
      recursos: ['Projetor', 'Videoconferência'],
    };
    const response = await request(app).put('/api/salas/1').send(updatedRoom);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 1, ...updatedRoom });
  });

  it('retorna 404 ao atualizar uma sala inexistente', async () => {
    const response = await request(app).put('/api/salas/999').send(validRoom);

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada.');
  });

  it('remove uma sala existente', async () => {
    await request(app).post('/api/salas').send(validRoom);
    const response = await request(app).delete('/api/salas/1');
    const listResponse = await request(app).get('/api/salas');

    assert.equal(response.status, 204);
    assert.equal(listResponse.status, 200);
    assert.deepEqual(listResponse.body, []);
  });

  it('retorna 404 ao remover uma sala inexistente', async () => {
    const response = await request(app).delete('/api/salas/999');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada.');
  });

  it('rejeita dados inválidos ao criar sala', async () => {
    const invalidRooms = [
      { ...validRoom, nome: '  ' },
      { ...validRoom, andar: 'segundo' },
      { ...validRoom, capacidade: 0 },
      { ...validRoom, recursos: 'Projetor' },
    ];

    for (const room of invalidRooms) {
      const response = await request(app).post('/api/salas').send(room);
      assert.equal(response.status, 400);
      assert.ok(Array.isArray(response.body.errors));
    }
  });

  it('rejeita identificadores que não sejam inteiros positivos', async () => {
    const invalidIds = ['abc', '4294967296'];

    for (const id of invalidIds) {
      const response = await request(app).get(`/api/salas/${id}`);
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'Identificador de sala inválido.');
    }
  });

  it('retorna 400 quando o corpo contém JSON malformado', async () => {
    const response = await request(app)
      .post('/api/salas')
      .set('Content-Type', 'application/json')
      .send('{');

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'O corpo da requisição deve conter JSON válido.');
  });
});
