const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

const validReservation = {
  sala: 1,
  data: '2026-12-10',
  inicio: '09:00',
  fim: '10:30',
  responsavel: 'Ana Silva',
  finalidade: 'Reunião de equipe',
  situacao: 'Pendente',
};

function createInMemoryRepositories() {
  const rooms = new Map([[1, { id: 1, nome: 'Sala de reuniões' }]]);
  const reservations = new Map();
  let nextId = 1;

  return {
    roomsRepository: {
      async findById(id) {
        return rooms.get(id) ?? null;
      },
    },
    reservationsRepository: {
      async findAll() {
        return [...reservations.values()];
      },
      async findById(id) {
        return reservations.get(id) ?? null;
      },
      async create(reservation) {
        const createdReservation = { id: nextId++, ...reservation };
        reservations.set(createdReservation.id, createdReservation);
        return createdReservation;
      },
      async update(id, reservation) {
        if (!reservations.has(id)) {
          return null;
        }

        const updatedReservation = { id, ...reservation };
        reservations.set(id, updatedReservation);
        return updatedReservation;
      },
      async delete(id) {
        return reservations.delete(id);
      },
    },
  };
}

describe('API de reservas', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      ...createInMemoryRepositories(),
      authenticateRequest: (req, res, next) => next(),
      authService: {
        async login() {},
        async requestPasswordReset() {},
        async resetPassword() {},
      },
      authService: {
        async login() {},
        async requestPasswordReset() {},
        async resetPassword() {},
      },
    });
  });

  it('lista todas as reservas', async () => {
    const response = await request(app).get('/api/reservas');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });

  it('cria uma reserva e a retorna com identificador', async () => {
    const response = await request(app).post('/api/reservas').send(validReservation);

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { id: 1, ...validReservation });
  });

  it('define Pendente quando a situação não é informada na criação', async () => {
    const { situacao, ...reservationWithoutStatus } = validReservation;
    const response = await request(app).post('/api/reservas').send(reservationWithoutStatus);

    assert.equal(response.status, 201);
    assert.equal(response.body.situacao, 'Pendente');
  });

  it('aceita as três situações previstas', async () => {
    for (const situacao of ['Pendente', 'Aprovada', 'Cancelada']) {
      const response = await request(app)
        .post('/api/reservas')
        .send({ ...validReservation, situacao });

      assert.equal(response.status, 201);
      assert.equal(response.body.situacao, situacao);
    }
  });

  it('busca uma reserva pelo identificador', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const response = await request(app).get('/api/reservas/1');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 1, ...validReservation });
  });

  it('retorna 404 ao buscar uma reserva inexistente', async () => {
    const response = await request(app).get('/api/reservas/999');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Reserva não encontrada.');
  });

  it('atualiza todos os dados de uma reserva', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const updatedReservation = {
      ...validReservation,
      sala: 1,
      inicio: '11:00',
      fim: '12:00',
      finalidade: 'Apresentação',
      situacao: 'Aprovada',
    };
    const response = await request(app).put('/api/reservas/1').send(updatedReservation);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 1, ...updatedReservation });
  });

  it('retorna 404 ao atualizar uma reserva inexistente', async () => {
    const response = await request(app).put('/api/reservas/999').send(validReservation);

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Reserva não encontrada.');
  });

  it('remove uma reserva existente', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const response = await request(app).delete('/api/reservas/1');
    const listResponse = await request(app).get('/api/reservas');

    assert.equal(response.status, 204);
    assert.deepEqual(listResponse.body, []);
  });

  it('retorna 404 ao remover uma reserva inexistente', async () => {
    const response = await request(app).delete('/api/reservas/999');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Reserva não encontrada.');
  });

  it('rejeita reservas com sala inexistente', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .send({ ...validReservation, sala: 999 });

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada.');
  });

  it('rejeita dados inválidos da reserva', async () => {
    const invalidReservations = [
      { ...validReservation, sala: 0 },
      { ...validReservation, data: '2026-02-30' },
      { ...validReservation, inicio: '25:00' },
      { ...validReservation, fim: '09:00' },
      { ...validReservation, responsavel: ' ' },
      { ...validReservation, finalidade: '' },
      { ...validReservation, situacao: 'Recusada' },
    ];

    for (const reservation of invalidReservations) {
      const response = await request(app).post('/api/reservas').send(reservation);
      assert.equal(response.status, 400);
      assert.ok(Array.isArray(response.body.errors));
    }
  });

  it('rejeita identificadores de reserva inválidos', async () => {
    const response = await request(app).get('/api/reservas/abc');

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'Identificador de reserva inválido.');
  });
});
