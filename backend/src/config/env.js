require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${name}`);
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.USE_MOCK_DB === 'true'
    ? 'mock://not-used'
    : required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || 'spit.ac.in',
  // Gmail account that sends the OTP. SMTP_PASS is a Google App Password, not
  // the account password. Leave unset to just log the code instead of mailing it.
  smtp: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || `RoutePool <${process.env.SMTP_USER}>`,
  },
  // Auto-rickshaw meter tariff: flat `baseFare` for the first `baseKm`, then
  // `perKmRate` per km beyond it, with `surgeMultiplier` added on top for the driver.
  autoTariff: {
    baseFare: parseFloat(process.env.AUTO_BASE_FARE || '27'),
    baseKm: parseFloat(process.env.AUTO_BASE_KM || '1.5'),
    perKmRate: parseFloat(process.env.AUTO_PER_KM_RATE || '18'),
    surgeMultiplier: parseFloat(process.env.AUTO_SURGE_MULTIPLIER || '1.2'),
  },
};
