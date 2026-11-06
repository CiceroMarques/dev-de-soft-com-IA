require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const databaseConfig = require('../config/database');
const { createApp } = require('./app');
const { createAuthenticateRequest } = require('./middleware/authenticate-request');
const { createPasswordResetTokensRepository } = require('./repositories/password-reset-tokens.repository');
const { createRoomsRepository } = require('./repositories/rooms.repository');
const { createReservationsRepository } = require('./repositories/reservations.repository');
const { createUsersRepository } = require('./repositories/users.repository');
const { createAuthService } = require('./services/auth.service');
const { createPasswordResetMailer, createSmtpTransport } = require('./services/password-reset-mailer');

/**
 * Starts the API after validating authentication and database configuration.
 *
 * @returns {Promise<object>} Express app, HTTP server, and MySQL pool.
 */
async function startServer() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres no arquivo .env.');
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('Configure FRONTEND_URL no arquivo .env.');
  }
  let frontendOrigin;
  try {
    const parsedFrontendUrl = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(parsedFrontendUrl.protocol)) {
      throw new Error('FRONTEND_URL deve usar HTTP ou HTTPS.');
    }
    frontendOrigin = parsedFrontendUrl.origin;
  } catch (error) {
    if (error.message === 'FRONTEND_URL deve usar HTTP ou HTTPS.') {
      throw error;
    }
    throw new Error('FRONTEND_URL deve ser uma URL válida HTTP ou HTTPS.');
  }
  const mailer = createPasswordResetMailer({
    transport: createSmtpTransport(),
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  });

  const pool = mysql.createPool({
    ...databaseConfig,
    timezone: 'Z',
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    const connection = await pool.getConnection();
    connection.release();
  } catch (error) {
    await pool.end();
    throw error;
  }

  const usersRepository = createUsersRepository(pool);
  const authService = createAuthService({
    usersRepository,
    passwordResetTokensRepository: createPasswordResetTokensRepository(pool),
    mailer,
    hashPassword: (password) => bcrypt.hash(password, 12),
    verifyPassword: (password, passwordHash) => bcrypt.compare(password, passwordHash),
    createAccessToken: (user) =>
      jwt.sign(
        { email: user.email },
        jwtSecret,
        {
          algorithm: 'HS256',
          subject: String(user.id),
          issuer: 'reserve-me-api',
          audience: 'reserve-me-client',
          expiresIn: '15m',
        },
      ),
    frontendUrl,
    resetTokenTtlMinutes: 30,
  });

  const app = createApp({
    roomsRepository: createRoomsRepository(pool),
    reservationsRepository: createReservationsRepository(pool),
    authService,
    authenticateRequest: createAuthenticateRequest({ secret: jwtSecret }),
    corsOrigin: frontendOrigin,
  });
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`API Reserve.me disponível na porta ${port}.`);
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { app, server, pool };
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Não foi possível iniciar a API Reserve.me:', error);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
