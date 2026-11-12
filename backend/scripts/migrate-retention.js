require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const databaseConfig = require('../config/database');

async function ensureActiveColumn(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'ativo'`,
    [table],
  );

  if (Number(rows[0].total) === 0) {
    await connection.execute(
      `ALTER TABLE ${table} ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1`,
    );
  }
}

async function applyRetentionMigration(connection) {
  await ensureActiveColumn(connection, 'salas');
  await ensureActiveColumn(connection, 'reservas');
  await connection.execute(
    "ALTER TABLE reservas MODIFY situacao ENUM('Pendente', 'Aprovada', 'Cancelada', 'Finalizada') NOT NULL DEFAULT 'Pendente'",
  );
  await connection.execute(
    "UPDATE reservas SET ativo = 0 WHERE situacao IN ('Cancelada', 'Finalizada')",
  );
}

async function migrateRetention() {
  const connection = await mysql.createConnection(databaseConfig);
  try {
    await applyRetentionMigration(connection);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrateRetention()
    .then(() => console.log('Migração concluída: salas e reservas preservadas com desativação lógica.'))
    .catch((error) => {
      console.error('Não foi possível aplicar a migração de retenção:', error);
      process.exitCode = 1;
    });
}

module.exports = { applyRetentionMigration, ensureActiveColumn };
