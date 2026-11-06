const jwt = require('jsonwebtoken');

/**
 * Creates middleware that verifies bearer access tokens.
 *
 * @param {object} options - Verification settings.
 * @param {string} options.secret - HMAC secret used to sign access tokens.
 * @returns {Function} Authentication middleware.
 */
function createAuthenticateRequest({ secret }) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SECRET deve conter ao menos 32 caracteres.');
  }

  return (req, res, next) => {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }

    try {
      const payload = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        issuer: 'reserve-me-api',
        audience: 'reserve-me-client',
      });

      const userId = Number(payload.sub);
      if (!Number.isSafeInteger(userId) || userId < 1) {
        return res.status(401).json({ error: 'Token de acesso inválido ou expirado.' });
      }

      req.user = { id: userId, email: payload.email };
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token de acesso inválido ou expirado.' });
      }

      return next(error);
    }
  };
}

module.exports = { createAuthenticateRequest };
