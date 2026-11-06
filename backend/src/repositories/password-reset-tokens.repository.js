/**
 * Creates the MySQL repository for one-time password reset tokens.
 *
 * @param {object} pool - MySQL connection pool.
 * @returns {object} Token persistence operations.
 */
function createPasswordResetTokensRepository(pool) {
  return {
    /**
     * Replaces outstanding reset tokens and stores a new token hash.
     *
     * @param {number} userId - Account that requested recovery.
     * @param {string} tokenHash - SHA-256 digest of the random reset token.
     * @param {Date} expiresAt - Expiration instant.
     * @returns {Promise<void>}
     */
    async create(userId, tokenHash, expiresAt) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          'DELETE FROM password_reset_tokens WHERE user_id = ? AND consumed_at IS NULL',
          [userId],
        );
        await connection.execute(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
          [userId, tokenHash, expiresAt],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    /**
     * Atomically consumes an unexpired token and changes its account password.
     *
     * @param {string} tokenHash - SHA-256 digest of the presented token.
     * @param {string} passwordHash - New bcrypt password hash.
     * @returns {Promise<boolean>} Whether a valid token was consumed.
     */
    async resetPassword(tokenHash, passwordHash) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          `SELECT id, user_id
           FROM password_reset_tokens
           WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
           FOR UPDATE`,
          [tokenHash],
        );

        if (rows.length === 0) {
          await connection.rollback();
          return false;
        }

        const { id, user_id: userId } = rows[0];
        const [updateResult] = await connection.execute(
          'UPDATE usuarios SET password_hash = ? WHERE id = ?',
          [passwordHash, userId],
        );

        if (updateResult.affectedRows === 0) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          'UPDATE password_reset_tokens SET consumed_at = UTC_TIMESTAMP() WHERE user_id = ? AND consumed_at IS NULL',
          [userId],
        );
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

module.exports = { createPasswordResetTokensRepository };
