require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const databaseConfig = require('../config/database');
const { createUsersRepository } = require('../src/repositories/users.repository');

const DEMO_ROOMS = [
  { nome: 'Sala de Reuniões A', andar: 1, capacidade: 12, recursos: ['Projetor', 'Quadro branco'] },
  { nome: 'Laboratório de Informática', andar: 2, capacidade: 28, recursos: ['Computadores', 'Projetor', 'Acesso à internet'] },
  { nome: 'Auditório', andar: 0, capacidade: 80, recursos: ['Microfone', 'Sistema de som', 'Projetor'] },
];

const DEMO_RESERVATIONS = [
  { room: DEMO_ROOMS[0].nome, day: 1, inicio: '09:00', fim: '10:00', finalidade: 'Reunião de planejamento', situacao: 'Aprovada' },
  { room: DEMO_ROOMS[1].nome, day: 1, inicio: '10:30', fim: '12:00', finalidade: 'Aula de programação', situacao: 'Pendente' },
  { room: DEMO_ROOMS[2].nome, day: 2, inicio: '14:00', fim: '15:30', finalidade: 'Palestra de integração', situacao: 'Aprovada' },
  { room: DEMO_ROOMS[0].nome, day: 3, inicio: '13:00', fim: '14:00', finalidade: 'Atendimento aos estudantes', situacao: 'Pendente' },
  { room: DEMO_ROOMS[1].nome, day: 4, inicio: '08:00', fim: '09:30', finalidade: 'Avaliação prática', situacao: 'Cancelada' },
];

/**
 * Returns a future YYYY-MM-DD string relative to the current UTC date.
 *
 * @param {number} offsetDays - Number of days to add.
 * @returns {string} SQL date.
 */
function futureDate(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Seeds three sample rooms, five reservations, and a local test account.
 * Existing room/reservation examples are reused, and an existing account's
 * password is never changed.
 *
 * @returns {Promise<{email: string, password: string, createdUser: boolean}>}
 */
async function seedDemoData() {
  const name = process.env.SEED_USER_NAME?.trim();
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Configure SEED_USER_NAME e um SEED_USER_EMAIL válido no arquivo .env.');
  }
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error('SEED_USER_PASSWORD deve ter ao menos 12 caracteres e no máximo 72 bytes.');
  }

  const pool = mysql.createPool(databaseConfig);
  let createdUser = false;

  try {
    const usersRepository = createUsersRepository(pool);
    let user = await usersRepository.findByEmail(email);
    if (!user) {
      user = await usersRepository.create({
        nome: name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
      });
      createdUser = true;
    }

    const roomIds = new Map();
    for (const room of DEMO_ROOMS) {
      const [existingRooms] = await pool.execute(
        'SELECT id FROM salas WHERE nome = ? LIMIT 1',
        [room.nome],
      );
      let roomId = existingRooms[0]?.id;

      if (!roomId) {
        const [result] = await pool.execute(
          'INSERT INTO salas (nome, andar, capacidade, recursos) VALUES (?, ?, ?, ?)',
          [room.nome, room.andar, room.capacidade, JSON.stringify(room.recursos)],
        );
        roomId = result.insertId;
      }

      roomIds.set(room.nome, Number(roomId));
    }

    for (const reservation of DEMO_RESERVATIONS) {
      const salaId = roomIds.get(reservation.room);
      const data = futureDate(reservation.day);
      const [existingReservations] = await pool.execute(
        `SELECT id FROM reservas
         WHERE sala_id = ? AND data = ? AND inicio = ? AND responsavel = ? AND finalidade = ?
         LIMIT 1`,
        [salaId, data, reservation.inicio, name, reservation.finalidade],
      );

      if (existingReservations.length > 0) {
        continue;
      }

      await pool.execute(
        `INSERT INTO reservas
         (sala_id, data, inicio, fim, responsavel, finalidade, situacao, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salaId,
          data,
          reservation.inicio,
          reservation.fim,
          name,
          reservation.finalidade,
          reservation.situacao,
          !['Cancelada', 'Finalizada'].includes(reservation.situacao),
        ],
      );
    }

    return { email, password, createdUser };
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoData()
    .then(({ email, password, createdUser }) => {
      console.log(`Dados de demonstração verificados: ${DEMO_ROOMS.length} salas e ${DEMO_RESERVATIONS.length} reservas.`);
      console.log(`Conta de teste: ${email}`);
      if (createdUser) {
        console.log(`Senha da conta recém-criada: ${password}`);
      } else {
        console.log('A conta já existia; a senha atual não foi alterada.');
      }
    })
    .catch((error) => {
      console.error('Não foi possível inserir os dados de demonstração:', error);
      process.exitCode = 1;
    });
}

module.exports = { DEMO_ROOMS, DEMO_RESERVATIONS, futureDate, seedDemoData };
