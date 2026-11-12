function mapReservation(row) {
  if (!row) {
    return null;
  }

  const date = row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data).slice(0, 10);

  return {
    id: Number(row.id),
    sala: Number(row.sala),
    data: date,
    inicio: String(row.inicio).slice(0, 5),
    fim: String(row.fim).slice(0, 5),
    responsavel: row.responsavel,
    finalidade: row.finalidade,
    situacao: row.situacao,
    ativo: Boolean(row.ativo),
  };
}

function createReservationsRepository(pool) {
  return {
    async findAll({ includeInactive = false } = {}) {
      const [rows] = await pool.execute(
        `SELECT id, sala_id AS sala, data, inicio, fim, responsavel, finalidade, situacao, ativo
         FROM reservas ${includeInactive ? '' : 'WHERE ativo = 1'}
         ORDER BY data, inicio, id`,
      );
      return rows.map(mapReservation);
    },

    async findById(id) {
      const [rows] = await pool.execute(
        'SELECT id, sala_id AS sala, data, inicio, fim, responsavel, finalidade, situacao, ativo FROM reservas WHERE id = ?',
        [id],
      );
      return mapReservation(rows[0]);
    },

    async create(reservation) {
      const [result] = await pool.execute(
        'INSERT INTO reservas (sala_id, data, inicio, fim, responsavel, finalidade, situacao, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          reservation.sala,
          reservation.data,
          reservation.inicio,
          reservation.fim,
          reservation.responsavel,
          reservation.finalidade,
          reservation.situacao,
          !['Cancelada', 'Finalizada'].includes(reservation.situacao),
        ],
      );
      return this.findById(result.insertId);
    },

    async update(id, reservation) {
      await pool.execute(
        "UPDATE reservas SET sala_id = ?, data = ?, inicio = ?, fim = ?, responsavel = ?, finalidade = ?, situacao = ?, ativo = IF(? IN ('Cancelada', 'Finalizada'), 0, ativo) WHERE id = ?",
        [
          reservation.sala,
          reservation.data,
          reservation.inicio,
          reservation.fim,
          reservation.responsavel,
          reservation.finalidade,
          reservation.situacao,
          reservation.situacao,
          id,
        ],
      );
      return this.findById(id);
    },

    async deactivate(id) {
      await pool.execute('UPDATE reservas SET ativo = 0 WHERE id = ?', [id]);
      const [rows] = await pool.execute('SELECT id FROM reservas WHERE id = ?', [id]);
      return rows.length > 0;
    },
  };
}

module.exports = { createReservationsRepository };
