const userModel = require('../../models/user.model');
const otpModel = require('../../models/otp.model');
const { generateOtp, hashOtp } = require('../../utils/otp');
const { signToken } = require('../../utils/jwt');
const ApiError = require('../../utils/ApiError');
const { sendOtpEmail, mailEnabled } = require('../../utils/mailer');
const env = require('../../config/env');
const { isFemale } = require('../../utils/genderRules');

// The student's own gender + pooling preferences. Only ever sent to that student.
const preferencesOf = (user) => ({
  gender: user.gender || null,
  womenOnlyGroups: Boolean(user.women_only_groups),
  driverPreference: user.driver_preference || 'any',
});

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

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error('[otp] email failed:', err.message);
    throw new ApiError(502, 'Could not send the verification email. Try again.');
  }

  return {
    message: 'Verification code sent',
    expiresInSeconds: env.otpExpiryMinutes * 60,
    // Never returned to the browser by default: the code arrives by email, or (with
    // no SMTP configured) is printed in the backend terminal. Test scripts like
    // scripts/checkGrouping.js can opt in with EXPOSE_DEV_OTP=true (dev only, no real mail).
    ...(process.env.EXPOSE_DEV_OTP === 'true' && env.nodeEnv !== 'production' && !mailEnabled ? { devCode: code } : {}),
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
      // Permanent code the rider reads out to the driver at pickup.
      riderCode: await userModel.ensureRiderCode(user.id),
      preferences: preferencesOf(user),
    },
  };
}

async function me(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.unauthorized('Session expired, please sign in again');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    branch: user.branch,
    totalRides: user.total_rides,
    riderCode: await userModel.ensureRiderCode(user.id),
    preferences: preferencesOf(user),
  };
}

// All optional. Women-only groups need gender 'female': the group stays closed to
// everyone else, so only women can start or join one.
async function updatePreferences(userId, { gender = null, womenOnlyGroups = false, driverPreference = 'any' }) {
  if (womenOnlyGroups && !isFemale({ gender })) {
    throw ApiError.badRequest('Women-only groups are available to students who set their gender as female.');
  }
  await userModel.updatePreferences(userId, { gender, womenOnlyGroups, driverPreference });
  return me(userId);
}

module.exports = { sendOtp, verifyOtp, me, updatePreferences };
