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
  const rooms = new Map([[1, { id: 1, nome: 'Sala de reuniões', ativo: true }]]);
  const reservations = new Map();
  let nextId = 1;

  return {
    roomsRepository: {
      async findById(id) {
        return rooms.get(id) ?? null;
      },
    },
    reservationsRepository: {
      async findAll({ includeInactive = false } = {}) {
        return [...reservations.values()].filter((reservation) => includeInactive || reservation.ativo);
      },
      async findById(id) {
        return reservations.get(id) ?? null;
      },
      async create(reservation) {
        const createdReservation = {
          id: nextId++,
          ...reservation,
          ativo: !['Cancelada', 'Finalizada'].includes(reservation.situacao),
        };
        reservations.set(createdReservation.id, createdReservation);
        return createdReservation;
      },
      async update(id, reservation) {
        if (!reservations.has(id)) {
          return null;
        }

        const updatedReservation = {
          ...reservations.get(id),
          ...reservation,
          ativo: ['Cancelada', 'Finalizada'].includes(reservation.situacao)
            ? false
            : reservations.get(id).ativo,
        };
        reservations.set(id, updatedReservation);
        return updatedReservation;
      },
      async deactivate(id) {
        const reservation = reservations.get(id);
        if (!reservation) {
          return false;
        }

        reservation.ativo = false;
        return true;
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
    assert.deepEqual(response.body, { id: 1, ...validReservation, ativo: true });
  });

  it('rejeita criação de reserva com horário sobreposto na mesma sala e data', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const response = await request(app)
      .post('/api/reservas')
      .send({ ...validReservation, inicio: '10:00', fim: '11:00' });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.error,
      'Já existe uma reserva ativa para esta sala, data e horário.',
    );
  });

  it('define Pendente quando a situação não é informada na criação', async () => {
    const { situacao, ...reservationWithoutStatus } = validReservation;
    const response = await request(app).post('/api/reservas').send(reservationWithoutStatus);

    assert.equal(response.status, 201);
    assert.equal(response.body.situacao, 'Pendente');
  });

  it('aceita as quatro situações previstas', async () => {
    const statuses = ['Pendente', 'Aprovada', 'Cancelada', 'Finalizada'];
    for (const [index, situacao] of statuses.entries()) {
      const response = await request(app)
        .post('/api/reservas')
        .send({
          ...validReservation,
          data: `2026-12-${String(10 + index).padStart(2, '0')}`,
          situacao,
        });

      assert.equal(response.status, 201);
      assert.equal(response.body.situacao, situacao);
      assert.equal(response.body.ativo, !['Cancelada', 'Finalizada'].includes(situacao));
    }
  });

  it('oculta reservas canceladas das listas comuns e mantém o histórico consultável', async () => {
    await request(app)
      .post('/api/reservas')
      .send({ ...validReservation, situacao: 'Cancelada' });

    const activeResponse = await request(app).get('/api/reservas');
    const historyResponse = await request(app).get('/api/reservas?includeInactive=true');

    assert.deepEqual(activeResponse.body, []);
    assert.deepEqual(historyResponse.body, [{
      id: 1,
      ...validReservation,
      situacao: 'Cancelada',
      ativo: false,
    }]);
  });

  it('busca uma reserva pelo identificador', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const response = await request(app).get('/api/reservas/1');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 1, ...validReservation, ativo: true });
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
    assert.deepEqual(response.body, { id: 1, ...updatedReservation, ativo: true });
  });

  it('retorna 404 ao atualizar uma reserva inexistente', async () => {
    const response = await request(app).put('/api/reservas/999').send(validReservation);

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Reserva não encontrada.');
  });

  it('rejeita atualização que crie conflito com outra reserva', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    await request(app)
      .post('/api/reservas')
      .send({ ...validReservation, inicio: '11:00', fim: '12:00' });

    const response = await request(app)
      .put('/api/reservas/2')
      .send({ ...validReservation, inicio: '10:00', fim: '11:30' });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.error,
      'Já existe uma reserva ativa para esta sala, data e horário.',
    );
  });

  it('desativa uma reserva sem apagar seu histórico', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    const response = await request(app).delete('/api/reservas/1');
    const listResponse = await request(app).get('/api/reservas');
    const historyResponse = await request(app).get('/api/reservas?includeInactive=true');

    assert.equal(response.status, 204);
    assert.deepEqual(listResponse.body, []);
    assert.deepEqual(historyResponse.body, [{ id: 1, ...validReservation, ativo: false }]);
  });

  it('permite desativar novamente uma reserva sem perder o registro', async () => {
    await request(app).post('/api/reservas').send(validReservation);
    await request(app).delete('/api/reservas/1');
    const response = await request(app).delete('/api/reservas/1');

    assert.equal(response.status, 204);
  });

  it('não permite criar reserva em sala desativada', async () => {
    const { roomsRepository } = createInMemoryRepositories();
    roomsRepository.findById = async () => ({ id: 1, nome: 'Sala desativada', ativo: false });
    const appWithInactiveRoom = createApp({
      roomsRepository,
      reservationsRepository: createInMemoryRepositories().reservationsRepository,
      authenticateRequest: (req, res, next) => next(),
      authService: {
        async login() {},
        async requestPasswordReset() {},
        async resetPassword() {},
      },
    });
    const response = await request(appWithInactiveRoom)
      .post('/api/reservas')
      .send(validReservation);

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada ou desativada.');
  });

  it('retorna 404 ao desativar uma reserva inexistente', async () => {
    const response = await request(app).delete('/api/reservas/999');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Reserva não encontrada.');
  });

  it('rejeita reservas com sala inexistente', async () => {
    const response = await request(app)
      .post('/api/reservas')
      .send({ ...validReservation, sala: 999 });

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Sala não encontrada ou desativada.');
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
