const { MIN_PASSWORD_LENGTH } = require('../services/auth.service');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

/**
 * Wraps an asynchronous route and forwards failures to Express error handling.
 *
 * @param {Function} handler - Asynchronous Express handler.
 * @returns {Function} Express-compatible handler.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Validates request payloads for the public authentication endpoints.
 *
 * @param {string} operation - Login, recovery, or password-reset operation.
 * @param {object} body - JSON request body.
 * @returns {object} Validation errors, if any.
 */
function validateAuthPayload(operation, body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['O corpo da requisição deve ser um objeto JSON.'] };
  }

  if (operation === 'login' || operation === 'forgot-password') {
    if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
      errors.push('Informe um e-mail válido.');
    } else if (body.email.trim().length > 254) {
      errors.push('O e-mail deve ter no máximo 254 caracteres.');
    }
  }

  if (operation === 'login') {
    if (typeof body.password !== 'string' || body.password.length === 0) {
      errors.push('A senha é obrigatória.');
    } else if (Buffer.byteLength(body.password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
      errors.push(`A senha não pode exceder ${MAX_BCRYPT_PASSWORD_BYTES} bytes.`);
    }
  }

  if (operation === 'reset-password') {
    if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/i.test(body.token)) {
      errors.push('O token de recuperação é inválido.');
    }
    if (
      typeof body.password !== 'string' ||
      body.password.length < MIN_PASSWORD_LENGTH ||
      Buffer.byteLength(body.password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES
    ) {
      errors.push(
        `A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres e no máximo ${MAX_BCRYPT_PASSWORD_BYTES} bytes.`,
      );
    }
  }

  return { errors };
}

/**
 * Creates controller handlers for login and password recovery.
 *
 * @param {object} authService - Authentication service.
 * @returns {object} Controller handlers.
 */
function createAuthController(authService) {
  return {
    /**
     * Authenticates an account and returns its access token.
     *
     * @type {Function}
     */
    login: asyncHandler(async (req, res) => {
      const { errors } = validateAuthPayload('login', req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      return res.json(await authService.login(req.body.email, req.body.password));
    }),

    /**
     * Requests an email containing a one-time password reset link.
     *
     * @type {Function}
     */
    forgotPassword: asyncHandler(async (req, res) => {
      const { errors } = validateAuthPayload('forgot-password', req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      return res.status(202).json(await authService.requestPasswordReset(req.body.email));
    }),

    /**
     * Consumes a reset token and saves a new password.
     *
     * @type {Function}
     */
    resetPassword: asyncHandler(async (req, res) => {
      const { errors } = validateAuthPayload('reset-password', req.body);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Dados inválidos.', errors });
      }

      return res.json(await authService.resetPassword(req.body.token, req.body.password));
    }),
  };
}

module.exports = { createAuthController, validateAuthPayload };
