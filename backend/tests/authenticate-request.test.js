const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createAuthenticateRequest } = require('../src/middleware/authenticate-request');

const secret = 'test-secret-with-more-than-thirty-two-characters';

describe('Middleware de autenticação', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.get('/protected', createAuthenticateRequest({ secret }), (req, res) => {
      res.json({ user: req.user });
    });
  });

  it('nega acesso sem bearer token', async () => {
    const response = await request(app).get('/protected');

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Autenticação necessária.');
  });

  it('nega token inválido', async () => {
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Token de acesso inválido ou expirado.');
  });

  it('aceita token assinado pela API e disponibiliza usuário na requisição', async () => {
    const token = jwt.sign(
      { email: 'staff@school.test' },
      secret,
      {
        algorithm: 'HS256',
        subject: '7',
        issuer: 'reserve-me-api',
        audience: 'reserve-me-client',
        expiresIn: '15m',
      },
    );
    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, { id: 7, email: 'staff@school.test' });
  });

  it('rejeita configuração com segredo fraco', () => {
    assert.throws(() => createAuthenticateRequest({ secret: 'short' }), /ao menos 32 caracteres/);
  });
});
