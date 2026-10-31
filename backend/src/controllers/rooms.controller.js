function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function readRoomId(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    res.status(400).json({ error: 'Identificador de sala inválido.' });
    return null;
  }

  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id > 4294967295) {
    res.status(400).json({ error: 'Identificador de sala inválido.' });
    return null;
  }

  return id;
}

function validateRoom(body) {
  const errors = [];
  const room = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { room, errors: ['O corpo da requisição deve ser um objeto JSON.'] };
  }

  if (typeof body.nome !== 'string' || body.nome.trim().length === 0) {
    errors.push('O campo nome é obrigatório.');
  } else if (body.nome.trim().length > 120) {
    errors.push('O campo nome deve ter no máximo 120 caracteres.');
  } else {
    room.nome = body.nome.trim();
  }

  if (
    !Number.isInteger(body.andar) ||
    body.andar < -2147483648 ||
    body.andar > 2147483647
  ) {
    errors.push('O campo andar deve ser um número inteiro válido.');
  } else {
    room.andar = body.andar;
  }

  if (
    !Number.isInteger(body.capacidade) ||
    body.capacidade < 1 ||
    body.capacidade > 4294967295
  ) {
    errors.push('O campo capacidade deve ser um número inteiro positivo válido.');
  } else {
    room.capacidade = body.capacidade;
  }

  if (!Array.isArray(body.recursos)) {
    errors.push('O campo recursos deve ser uma lista de textos.');
  } else if (
    body.recursos.some((resource) => typeof resource !== 'string' || resource.trim().length === 0)
  ) {
    errors.push('Cada recurso deve ser um texto não vazio.');
  } else {
    room.recursos = body.recursos.map((resource) => resource.trim());
  }

  return { room, errors };
}

function createRoomsController(roomsRepository) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(await roomsRepository.findAll());
    }),

    getById: asyncHandler(async (req, res) => {
      const id = readRoomId(req, res);
      if (id === null) {
        return;
      }

      const room = await roomsRepository.findById(id);
      if (!room) {
        return res.status(404).json({ error: 'Sala não encontrada.' });
      }

      return res.json(room);
    }),

    create: asyncHandler(async (req, res) => {
      const { room, errors } = validateRoom(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      return res.status(201).json(await roomsRepository.create(room));
    }),

    update: asyncHandler(async (req, res) => {
      const id = readRoomId(req, res);
      if (id === null) {
        return;
      }

      const { room, errors } = validateRoom(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      const updatedRoom = await roomsRepository.update(id, room);
      if (!updatedRoom) {
        return res.status(404).json({ error: 'Sala não encontrada.' });
      }

      return res.json(updatedRoom);
    }),

    remove: asyncHandler(async (req, res) => {
      const id = readRoomId(req, res);
      if (id === null) {
        return;
      }

      const removed = await roomsRepository.delete(id);
      if (!removed) {
        return res.status(404).json({ error: 'Sala não encontrada.' });
      }

      return res.status(204).end();
    }),
  };
}

module.exports = { createRoomsController, validateRoom };
