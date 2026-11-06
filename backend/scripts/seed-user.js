require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const databaseConfig = require('../config/database');
const { createUsersRepository } = require('../src/repositories/users.repository');

/**
 * Creates the initial manager account from environment variables.
 *
 * Existing accounts are left unchanged so rerunning the seed never resets a
 * password unexpectedly.
 *
 * @returns {Promise<void>}
 */
async function seedInitialUser() {
  const { SEED_USER_NAME: nome, SEED_USER_EMAIL, SEED_USER_PASSWORD } = process.env;
  const email = SEED_USER_EMAIL?.trim().toLowerCase();

  if (!nome?.trim() || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Configure SEED_USER_NAME e um SEED_USER_EMAIL válido no arquivo .env.');
  }
  if (
    typeof SEED_USER_PASSWORD !== 'string' ||
    SEED_USER_PASSWORD.length < 12 ||
    Buffer.byteLength(SEED_USER_PASSWORD, 'utf8') > 72
  ) {
    throw new Error('SEED_USER_PASSWORD deve ter ao menos 12 caracteres e no máximo 72 bytes.');
  }

  const pool = mysql.createPool(databaseConfig);
  try {
    const repository = createUsersRepository(pool);
    const existingUser = await repository.findByEmail(email);
    if (existingUser) {
      console.log(`A conta ${email} já existe; nenhuma senha foi alterada.`);
      return;
    }

    await repository.create({
      nome: nome.trim(),
      email,
      passwordHash: await bcrypt.hash(SEED_USER_PASSWORD, 12),
    });
    console.log(`Conta inicial criada para ${email}.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedInitialUser().catch((error) => {
    console.error('Não foi possível criar a conta inicial:', error);
    process.exitCode = 1;
  });
}

module.exports = { seedInitialUser };
