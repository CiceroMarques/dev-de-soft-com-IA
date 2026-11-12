const express = require('express');
const cors = require('cors');
const { createRoomsRouter } = require('./routes/rooms.routes');
const { createReservationsRouter } = require('./routes/reservations.routes');
const { createAuthRouter } = require('./routes/auth.routes');

function isAllowedLocalOrigin(origin, configuredOrigin) {
  try {
    const requestUrl = new URL(origin);
    const configuredUrl = new URL(configuredOrigin);
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

    return (
      requestUrl.protocol === configuredUrl.protocol &&
      requestUrl.port === configuredUrl.port &&
      localHosts.has(requestUrl.hostname) &&
      localHosts.has(configuredUrl.hostname)
    );
  } catch {
    return false;
  }
}

function createApp({
  roomsRepository,
  reservationsRepository,
  authService,
  authenticateRequest,
  corsOrigin,
}) {
  if (!roomsRepository || !reservationsRepository || !authService || !authenticateRequest) {
    throw new Error('Dependências da aplicação não foram fornecidas.');
  }

  const app = express();

  if (corsOrigin) {
    app.use(
      cors({
        origin(origin, callback) {
          callback(
            null,
            !origin || origin === corsOrigin || isAllowedLocalOrigin(origin, corsOrigin),
          );
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      }),
    );
  }
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/salas', authenticateRequest, createRoomsRouter(roomsRepository));
  app.use(
    '/api/reservas',
    authenticateRequest,
    createReservationsRouter(reservationsRepository, roomsRepository),
  );

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

    if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error.statusCode === 503) {
      return res.status(503).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  });

  return app;
}

module.exports = { createApp };
