require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const databaseConfig = require('../config/database');
const { createApp } = require('./app');
const { createRoomsRepository } = require('./repositories/rooms.repository');
const { createReservationsRepository } = require('./repositories/reservations.repository');

async function startServer() {
  const pool = mysql.createPool({
    ...databaseConfig,
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

  const app = createApp({
    roomsRepository: createRoomsRepository(pool),
    reservationsRepository: createReservationsRepository(pool),
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
