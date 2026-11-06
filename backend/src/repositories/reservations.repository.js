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
  };
}

function createReservationsRepository(pool) {
  return {
    async findAll() {
      const [rows] = await pool.execute(
        'SELECT id, sala_id AS sala, data, inicio, fim, responsavel, finalidade, situacao FROM reservas ORDER BY data, inicio, id',
      );
      return rows.map(mapReservation);
    },

    async findById(id) {
      const [rows] = await pool.execute(
        'SELECT id, sala_id AS sala, data, inicio, fim, responsavel, finalidade, situacao FROM reservas WHERE id = ?',
        [id],
      );
      return mapReservation(rows[0]);
    },

    async create(reservation) {
      const [result] = await pool.execute(
        'INSERT INTO reservas (sala_id, data, inicio, fim, responsavel, finalidade, situacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          reservation.sala,
          reservation.data,
          reservation.inicio,
          reservation.fim,
          reservation.responsavel,
          reservation.finalidade,
          reservation.situacao,
        ],
      );
      return this.findById(result.insertId);
    },

    async update(id, reservation) {
      await pool.execute(
        'UPDATE reservas SET sala_id = ?, data = ?, inicio = ?, fim = ?, responsavel = ?, finalidade = ?, situacao = ? WHERE id = ?',
        [
          reservation.sala,
          reservation.data,
          reservation.inicio,
          reservation.fim,
          reservation.responsavel,
          reservation.finalidade,
          reservation.situacao,
          id,
        ],
      );
      return this.findById(id);
    },

    async delete(id) {
      const [result] = await pool.execute('DELETE FROM reservas WHERE id = ?', [id]);
      return result.affectedRows > 0;
    },
  };
}

module.exports = { createReservationsRepository };
