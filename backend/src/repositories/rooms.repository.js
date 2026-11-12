function normalizeResources(resources) {
  if (Array.isArray(resources)) {
    return resources;
  }

  if (typeof resources === 'string') {
    const parsedResources = JSON.parse(resources);
    if (Array.isArray(parsedResources)) {
      return parsedResources;
    }
  }

  throw new TypeError('O banco retornou recursos da sala em formato inválido.');
}

function mapRoom(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    nome: row.nome,
    andar: row.andar,
    capacidade: row.capacidade,
    recursos: normalizeResources(row.recursos),
    ativo: Boolean(row.ativo),
  };
}

function createRoomsRepository(pool) {
  return {
    async findAll({ includeInactive = false } = {}) {
      const [rows] = await pool.execute(
        `SELECT id, nome, andar, capacidade, recursos, ativo
         FROM salas ${includeInactive ? '' : 'WHERE ativo = 1'}
         ORDER BY id`,
      );
      return rows.map(mapRoom);
    },

    async findById(id) {
      const [rows] = await pool.execute(
        'SELECT id, nome, andar, capacidade, recursos, ativo FROM salas WHERE id = ?',
        [id],
      );
      return mapRoom(rows[0]);
    },

    async create(room) {
      const [result] = await pool.execute(
        'INSERT INTO salas (nome, andar, capacidade, recursos) VALUES (?, ?, ?, ?)',
        [room.nome, room.andar, room.capacidade, JSON.stringify(room.recursos)],
      );
      return this.findById(result.insertId);
    },

    async update(id, room) {
      await pool.execute(
        'UPDATE salas SET nome = ?, andar = ?, capacidade = ?, recursos = ? WHERE id = ?',
        [room.nome, room.andar, room.capacidade, JSON.stringify(room.recursos), id],
      );
      return this.findById(id);
    },

    async deactivate(id) {
      await pool.execute('UPDATE salas SET ativo = 0 WHERE id = ?', [id]);
      const [rows] = await pool.execute('SELECT id FROM salas WHERE id = ?', [id]);
      return rows.length > 0;
    },
  };
}

module.exports = { createRoomsRepository };
