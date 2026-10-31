const express = require('express');
const { createRoomsRouter } = require('./routes/rooms.routes');

function createApp({ roomsRepository }) {
  if (!roomsRepository) {
    throw new Error('Um repositório de salas deve ser fornecido.');
  }

  const app = express();

  app.use(express.json());
  app.use('/api/salas', createRoomsRouter(roomsRepository));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'O corpo da requisição deve conter JSON válido.' });
    }

    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  });

  return app;
}

module.exports = { createApp };
