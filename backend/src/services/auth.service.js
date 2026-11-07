const { createHash, randomBytes } = require('node:crypto');

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const RESET_TOKEN_TTL_MINUTES = 30;
const MIN_PASSWORD_LENGTH = 12;
const DUMMY_PASSWORD_HASH = '$2b$12$3VAmHtwo52zZlNodEdQIOOECDry8SKpUIr00en4OH//H3fng8KETm';

/**
 * Creates an HTTP-aware error for authentication flows.
 *
 * @param {string} message - Safe message suitable for an API response.
 * @param {number} statusCode - HTTP status code.
 * @returns {Error} Error carrying an HTTP status code.
 */
function createAuthError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Hashes a reset token before it is stored or looked up in the database.
 *
 * @param {string} token - Random reset token.
 * @returns {string} SHA-256 hexadecimal digest.
 */
function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates authentication and password recovery operations.
 *
 * @param {object} dependencies - Injected persistence and security adapters.
 * @param {object} dependencies.usersRepository - User account repository.
 * @param {object} dependencies.passwordResetTokensRepository - One-time token repository.
 * @param {object} dependencies.mailer - Adapter with `sendPasswordReset(email, url)`.
 * @param {Function} dependencies.hashPassword - Password hashing function.
 * @param {Function} dependencies.verifyPassword - Password comparison function.
 * @param {Function} dependencies.createAccessToken - Access-token signer.
 * @param {string} dependencies.frontendUrl - Base URL for the reset form.
 * @param {number} [dependencies.resetTokenTtlMinutes=30] - Reset token lifetime.
 * @param {string} [dependencies.dummyPasswordHash] - Bcrypt hash used for timing parity on unknown accounts.
 * @returns {object} Authentication and recovery operations.
 */
function createAuthService({
  usersRepository,
  passwordResetTokensRepository,
  mailer,
  hashPassword,
  verifyPassword,
  createAccessToken,
  frontendUrl,
  resetTokenTtlMinutes = RESET_TOKEN_TTL_MINUTES,
  dummyPasswordHash = DUMMY_PASSWORD_HASH,
}) {
  if (
    !usersRepository ||
    !passwordResetTokensRepository ||
    !mailer ||
    typeof hashPassword !== 'function' ||
    typeof verifyPassword !== 'function' ||
    typeof createAccessToken !== 'function' ||
    typeof frontendUrl !== 'string'
  ) {
    throw new TypeError('Dependências incompletas para o serviço de autenticação.');
  }
  if (!Number.isFinite(resetTokenTtlMinutes) || resetTokenTtlMinutes < 1) {
    throw new TypeError('O prazo do token de recuperação deve ser positivo.');
  }
  try {
    const parsedFrontendUrl = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(parsedFrontendUrl.protocol)) {
      throw new TypeError('FRONTEND_URL deve usar HTTP ou HTTPS.');
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'FRONTEND_URL deve usar HTTP ou HTTPS.') {
      throw error;
    }
    throw new TypeError('FRONTEND_URL deve ser uma URL válida.');
  }

  return {
    /**
     * Verifies credentials and returns a short-lived access token.
     *
     * @param {string} email - User email address.
     * @param {string} password - Plain-text password received over HTTPS.
     * @returns {Promise<object>} Access token and safe public user information.
     * @throws {Error} With status 401 when the credentials are invalid.
     */
    async login(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await usersRepository.findByEmail(normalizedEmail);
      const passwordMatches = await verifyPassword(
        password,
        user ? user.passwordHash : dummyPasswordHash,
      );

      if (!user || !passwordMatches) {
        throw createAuthError('E-mail ou senha inválidos.', 401);
      }

      return {
        accessToken: createAccessToken(user),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: { id: user.id, nome: user.nome, email: user.email },
      };
    },

    /**
     * Sends a single-use password reset link when the email belongs to an account.
     * The same success response is used for registered and unknown addresses.
     *
     * @param {string} email - Account email address.
     * @returns {Promise<object>} Non-enumerating confirmation.
     */
    async requestPasswordReset(email) {
      const genericResponse = {
        message: 'Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.',
      };
      if (mailer.isConfigured === false) {
        throw createAuthError('Recuperação de senha não está configurada neste ambiente.', 503);
      }

      const user = await usersRepository.findByEmail(email.trim().toLowerCase());
      if (!user) {
        return genericResponse;
      }

      const token = randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + resetTokenTtlMinutes * 60_000);
      await passwordResetTokensRepository.create(user.id, tokenHash, expiresAt);

      const resetUrl = new URL(
        'redefinir-senha.html',
        `${frontendUrl.replace(/\/+$/, '')}/`,
      );
      resetUrl.searchParams.set('token', token);

      try {
        await mailer.sendPasswordReset(user.email, resetUrl.toString());
      } catch (error) {
        console.error('Falha ao enviar e-mail de recuperação de senha:', error);
        throw createAuthError('Não foi possível enviar o e-mail agora. Tente novamente mais tarde.', 503);
      }

      return genericResponse;
    },

    /**
     * Validates and consumes a one-time reset token, then stores a fresh password hash.
     *
     * @param {string} token - Raw token from the emailed reset link.
     * @param {string} password - New plain-text password.
     * @returns {Promise<object>} Reset confirmation.
     * @throws {Error} With status 400 for invalid, expired, or reused tokens.
     */
    async resetPassword(token, password) {
      const passwordHash = await hashPassword(password);
      const reset = await passwordResetTokensRepository.resetPassword(
        hashResetToken(token),
        passwordHash,
      );

      if (!reset) {
        throw createAuthError('Token inválido, expirado ou já utilizado.', 400);
      }

      return { message: 'Senha redefinida com sucesso.' };
    },
  };
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  MIN_PASSWORD_LENGTH,
  createAuthError,
  createAuthService,
  hashResetToken,
};
