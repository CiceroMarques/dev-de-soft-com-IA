/**
 * Creates the MySQL repository for user accounts.
 *
 * @param {object} pool - MySQL connection pool.
 * @returns {object} User persistence operations.
 */
function createUsersRepository(pool) {
  return {
    /**
     * Finds an account by its normalized email address.
     *
     * @param {string} email - Normalized account email.
     * @returns {Promise<object|null>} User with password hash, or null.
     */
    async findByEmail(email) {
      const [rows] = await pool.execute(
        'SELECT id, nome, email, password_hash AS passwordHash FROM usuarios WHERE email = ? LIMIT 1',
        [email],
      );
      return rows[0] ?? null;
    },

    /**
     * Finds an account by its primary key.
     *
     * @param {number} id - User ID.
     * @returns {Promise<object|null>} Public user fields, or null.
     */
    async findById(id) {
      const [rows] = await pool.execute(
        'SELECT id, nome, email FROM usuarios WHERE id = ? LIMIT 1',
        [id],
      );
      return rows[0] ?? null;
    },

    /**
     * Creates a user account.
     *
     * @param {object} user - Validated account data.
     * @returns {Promise<object>} Created account without its password hash.
     */
    async create(user) {
      const [result] = await pool.execute(
        'INSERT INTO usuarios (nome, email, password_hash) VALUES (?, ?, ?)',
        [user.nome, user.email, user.passwordHash],
      );
      return {
        id: Number(result.insertId),
        nome: user.nome,
        email: user.email,
      };
    },

    /**
     * Replaces the stored password hash.
     *
     * @param {number} id - User ID.
     * @param {string} passwordHash - New bcrypt password hash.
     * @returns {Promise<boolean>} Whether an account was updated.
     */
    async updatePassword(id, passwordHash) {
      const [result] = await pool.execute(
        'UPDATE usuarios SET password_hash = ? WHERE id = ?',
        [passwordHash, id],
      );
      return result.affectedRows > 0;
    },
  };
}

module.exports = { createUsersRepository };
