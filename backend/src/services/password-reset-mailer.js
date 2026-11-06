const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transport from environment configuration.
 *
 * @param {NodeJS.ProcessEnv} [environment=process.env] - Environment variables.
 * @returns {object} Configured SMTP transporter.
 * @throws {Error} When required SMTP configuration is missing.
 */
function createSmtpTransport(environment = process.env) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = environment;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('Configuração SMTP incompleta. Verifique SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASSWORD.');
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT deve ser uma porta válida.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

/**
 * Creates an adapter that sends password reset links using SMTP.
 *
 * @param {object} options - Mailer options.
 * @param {object} options.transport - SMTP transport.
 * @param {string} options.from - Sender address shown in the email.
 * @returns {object} Mail adapter.
 */
function createPasswordResetMailer({ transport, from }) {
  return {
    /**
     * Sends a single-use password reset link.
     *
     * @param {string} email - Recipient account address.
     * @param {string} resetUrl - URL containing the raw one-time token.
     * @returns {Promise<void>}
     */
    async sendPasswordReset(email, resetUrl) {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Redefinição de senha | Reserve.me',
        text: `Use este link para redefinir sua senha. Ele expira em 30 minutos e só pode ser usado uma vez:\n\n${resetUrl}\n\nSe você não solicitou a redefinição, ignore esta mensagem.`,
        html: `<p>Use o link abaixo para redefinir sua senha. Ele expira em 30 minutos e só pode ser usado uma vez.</p><p><a href="${resetUrl}">Redefinir senha</a></p><p>Se você não solicitou a redefinição, ignore esta mensagem.</p>`,
      });
    },
  };
}

module.exports = { createPasswordResetMailer, createSmtpTransport };
