const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { createAuthController } = require('../controllers/auth.controller');

/**
 * Creates public authentication endpoints with per-IP request limits.
 *
 * @param {object} authService - Authentication service.
 * @param {object} [options] - Rate-limit settings, configurable for tests.
 * @param {number} [options.windowMs=900000] - Time window in milliseconds.
 * @param {number} [options.loginLimit=5] - Login requests permitted in the time window.
 * @param {number} [options.recoveryLimit=3] - Recovery requests permitted in the time window.
 * @returns {object} Express router for authentication.
 */
function createAuthRouter(authService, options = {}) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const rateLimitHandler = (req, res) =>
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  const loginLimiter = rateLimit({
    windowMs,
    limit: options.loginLimit ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
  const recoveryLimiter = rateLimit({
    windowMs,
    limit: options.recoveryLimit ?? 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

  router.post('/login', loginLimiter, controller.login);
  router.post('/forgot-password', recoveryLimiter, controller.forgotPassword);
  router.post('/reset-password', recoveryLimiter, controller.resetPassword);

  return router;
}

module.exports = { createAuthRouter };
