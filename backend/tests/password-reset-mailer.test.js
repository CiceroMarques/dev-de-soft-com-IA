const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  createPasswordResetMailer,
  createSmtpTransport,
} = require('../src/services/password-reset-mailer');

describe('Mailer de recuperação de senha', () => {
  it('envia um e-mail de redefinição ao endereço cadastrado', async () => {
    let message;
    const mailer = createPasswordResetMailer({
      from: 'Reserve.me <no-reply@example.com>',
      transport: {
        async sendMail(mail) {
          message = mail;
        },
      },
    });

    await mailer.sendPasswordReset(
      'staff@school.test',
      'https://school.test/redefinir-senha.html?token=sample',
    );

    assert.equal(message.to, 'staff@school.test');
    assert.equal(message.from, 'Reserve.me <no-reply@example.com>');
    assert.match(message.text, /sample/);
    assert.match(message.html, /redefinir sua senha/);
  });

  it('exige configuração SMTP completa', () => {
    assert.throws(() => createSmtpTransport({}), /Configuração SMTP incompleta/);
  });

  it('rejeita porta SMTP inválida', () => {
    assert.throws(
      () => createSmtpTransport({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '70000',
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'password',
      }),
      /SMTP_PORT deve ser uma porta válida/,
    );
  });
});
