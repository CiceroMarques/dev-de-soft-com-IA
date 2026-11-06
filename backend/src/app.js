const express = require('express');
const { createRoomsRouter } = require('./routes/rooms.routes');
const { createReservationsRouter } = require('./routes/reservations.routes');

function createApp({ roomsRepository, reservationsRepository }) {
  if (!roomsRepository || !reservationsRepository) {
    throw new Error('Os repositórios de salas e reservas devem ser fornecidos.');
  }

  const app = express();

  app.use(express.json());
  app.use('/api/salas', createRoomsRouter(roomsRepository));
  app.use('/api/reservas', createReservationsRouter(reservationsRepository, roomsRepository));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'O corpo da requisição deve conter JSON válido.' });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Não é possível excluir uma sala com reservas associadas.' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  });

  return app;
}

module.exports = { createApp };
