const userModel = require('../../models/user.model');
const otpModel = require('../../models/otp.model');
const { generateOtp, hashOtp } = require('../../utils/otp');
const { signToken } = require('../../utils/jwt');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

function assertAllowedDomain(email) {
  const domain = email.split('@')[1];
  if (domain !== env.allowedEmailDomain) {
    throw ApiError.badRequest(`Only @${env.allowedEmailDomain} email addresses can request or join a pool`);
  }
}

function deriveIdentity(email) {
  const local = email.split('@')[0];
  const parts = local.split(/[._]/).filter(Boolean);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || local;
  const initials = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || local.slice(0, 2).toUpperCase();
  return { name, initials };
}

async function sendOtp(email) {
  assertAllowedDomain(email);
  await otpModel.invalidateAllForEmail(email);

  const code = generateOtp();
  const codeHash = hashOtp(code, email);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);
  await otpModel.create({ email, codeHash, expiresAt });

  // Simulated send: in production this would call an email/SMS provider.
  console.log(`[otp] ${email} -> ${code} (expires in ${env.otpExpiryMinutes}m)`);

  return {
    message: 'Verification code sent',
    expiresInSeconds: env.otpExpiryMinutes * 60,
    // Only surfaced outside production so the API is testable without a real mail provider.
    ...(env.nodeEnv !== 'production' ? { devCode: code } : {}),
  };
}

async function verifyOtp(email, code) {
  assertAllowedDomain(email);
  const record = await otpModel.findLatestActive(email);
  if (!record) throw ApiError.badRequest('No active verification code for this email. Request a new one.');
  if (record.code_hash !== hashOtp(code, email)) throw ApiError.badRequest('Incorrect verification code');

  await otpModel.consume(record.id);

  let user = await userModel.findByEmail(email);
  if (!user) {
    const { name, initials } = deriveIdentity(email);
    user = await userModel.createVerified({ email, name, initials, branch: null });
  } else if (!user.is_verified) {
    user = await userModel.markVerified(user.id);
  }

  const token = signToken(user);
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: user.initials,
      branch: user.branch,
      isVerified: user.is_verified,
      totalRides: user.total_rides,
      totalSavings: Number(user.total_savings),
    },
  };
}

module.exports = { sendOtp, verifyOtp };
