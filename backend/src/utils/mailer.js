const nodemailer = require('nodemailer');
const env = require('../config/env');

// No SMTP credentials configured -> keep the old behaviour and just log the code,
// so the app (and scripts/checkGrouping.js) still work without a mail account.
const transport = env.smtp.user && env.smtp.pass
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: env.smtp.user, pass: env.smtp.pass } })
  : null;

const mailEnabled = Boolean(transport);

async function sendOtpEmail(email, code) {
  if (!transport) {
    console.log(`[otp] ${email} -> ${code} (expires in ${env.otpExpiryMinutes}m)`);
    return;
  }
  await transport.sendMail({
    from: env.smtp.from,
    to: email,
    subject: `${code} is your RoutePool verification code`,
    text: `Your RoutePool verification code is ${code}. It expires in ${env.otpExpiryMinutes} minutes.\n\nIf you didn't request it, ignore this email.`,
  });
}

module.exports = { sendOtpEmail, mailEnabled };
