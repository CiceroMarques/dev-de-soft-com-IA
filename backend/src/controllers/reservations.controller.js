const RESERVATION_STATUSES = ['Pendente', 'Aprovada', 'Cancelada', 'Finalizada'];
const MAX_UNSIGNED_INT = 4294967295;
const { existeConflito } = require('../services/reservation-conflict');

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function readReservationId(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    res.status(400).json({ error: 'Identificador de reserva inválido.' });
    return null;
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id > MAX_UNSIGNED_INT) {
    res.status(400).json({ error: 'Identificador de reserva inválido.' });
    return null;
  }

  return id;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return (
    year >= 1000 &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function validateReservation(body, { defaultStatus = false } = {}) {
  const errors = [];
  const reservation = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      reservation,
      errors: ['O corpo da requisição deve ser um objeto JSON.'],
    };
  }

  if (!Number.isInteger(body.sala) || body.sala < 1 || body.sala > MAX_UNSIGNED_INT) {
    errors.push('O campo sala deve ser um identificador inteiro positivo.');
  } else {
    reservation.sala = body.sala;
  }

  if (!isValidDate(body.data)) {
    errors.push('O campo data deve ser uma data válida no formato AAAA-MM-DD.');
  } else {
    reservation.data = body.data;
  }

  const validTime = (value) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const hasValidStart = validTime(body.inicio);
  const hasValidEnd = validTime(body.fim);

  if (!hasValidStart) {
    errors.push('O campo inicio deve estar no formato HH:mm.');
  } else {
    reservation.inicio = body.inicio;
  }

  if (!hasValidEnd) {
    errors.push('O campo fim deve estar no formato HH:mm.');
  } else {
    reservation.fim = body.fim;
  }

  if (hasValidStart && hasValidEnd && body.fim <= body.inicio) {
    errors.push('O horário fim deve ser posterior ao horário inicio.');
  }

  if (typeof body.responsavel !== 'string' || body.responsavel.trim().length === 0) {
    errors.push('O campo responsavel é obrigatório.');
  } else if (body.responsavel.trim().length > 120) {
    errors.push('O campo responsavel deve ter no máximo 120 caracteres.');
  } else {
    reservation.responsavel = body.responsavel.trim();
  }

  if (typeof body.finalidade !== 'string' || body.finalidade.trim().length === 0) {
    errors.push('O campo finalidade é obrigatório.');
  } else if (body.finalidade.trim().length > 500) {
    errors.push('O campo finalidade deve ter no máximo 500 caracteres.');
  } else {
    reservation.finalidade = body.finalidade.trim();
  }

  const status = body.situacao === undefined && defaultStatus ? 'Pendente' : body.situacao;
  if (!RESERVATION_STATUSES.includes(status)) {
    errors.push(`O campo situacao deve ser um dos valores: ${RESERVATION_STATUSES.join(', ')}.`);
  } else {
    reservation.situacao = status;
  }

  return { reservation, errors };
}

function createReservationsController(reservationsRepository, roomsRepository) {
  return {
    list: asyncHandler(async (req, res) => {
      const includeInactive = req.query.includeInactive === 'true';
      res.json(await reservationsRepository.findAll({ includeInactive }));
    }),

    getById: asyncHandler(async (req, res) => {
      const id = readReservationId(req, res);
      if (id === null) {
        return;
      }

      const reservation = await reservationsRepository.findById(id);
      if (!reservation) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }

      return res.json(reservation);
    }),

    create: asyncHandler(async (req, res) => {
      const { reservation, errors } = validateReservation(req.body, { defaultStatus: true });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      const room = await roomsRepository.findById(reservation.sala);
      if (!room || room.ativo === false) {
        return res.status(404).json({ error: 'Sala não encontrada ou desativada.' });
      }

      const existingReservations = await reservationsRepository.findAll();
      if (existeConflito(reservation, existingReservations)) {
        return res.status(409).json({
          error: 'Já existe uma reserva ativa para esta sala, data e horário.',
        });
      }

      return res.status(201).json(await reservationsRepository.create(reservation));
    }),

    update: asyncHandler(async (req, res) => {
      const id = readReservationId(req, res);
      if (id === null) {
        return;
      }

      const { reservation, errors } = validateReservation(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      const room = await roomsRepository.findById(reservation.sala);
      if (!room || room.ativo === false) {
        return res.status(404).json({ error: 'Sala não encontrada ou desativada.' });
      }

      const existingReservation = await reservationsRepository.findById(id);
      if (!existingReservation) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }

      const existingReservations = await reservationsRepository.findAll();
      if (
        existeConflito(
          { ...reservation, id, ativo: existingReservation.ativo },
          existingReservations,
        )
      ) {
        return res.status(409).json({
          error: 'Já existe uma reserva ativa para esta sala, data e horário.',
        });
      }

      const updatedReservation = await reservationsRepository.update(id, reservation);
      if (!updatedReservation) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }

      return res.json(updatedReservation);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = readReservationId(req, res);
      if (id === null) {
        return;
      }

      const deactivated = await reservationsRepository.deactivate(id);
      if (!deactivated) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }

      return res.status(204).end();
    }),
  };
}

module.exports = {
  RESERVATION_STATUSES,
  createReservationsController,
  validateReservation,
};
