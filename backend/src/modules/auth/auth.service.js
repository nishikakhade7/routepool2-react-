const userModel = require('../../models/user.model');
const otpModel = require('../../models/otp.model');
const { generateOtp, hashOtp } = require('../../utils/otp');
const { signToken } = require('../../utils/jwt');
const ApiError = require('../../utils/ApiError');
const { sendOtpEmail, mailEnabled } = require('../../utils/mailer');
const { isAdmin } = require('../../middleware/requireAdmin');
const { verifyPassword } = require('../../utils/password');
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
  // Staff sign in with a password, so an admin address never gets a code -
  // otherwise the password would just be a second, weaker door.
  if (isAdmin(email)) throw ApiError.badRequest('This is a staff account — enter your password.', { code: 'STAFF_PASSWORD_REQUIRED' });
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
    user: await publicUser(user),
  };
}

// The session payload both sign-in routes return.
async function publicUser(user) {
  return {
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
    isAdmin: isAdmin(user.email),
    preferences: preferencesOf(user),
  };
}

// Wrong-password lockout, per email, in memory (one backend process).
// ponytail: resets on restart; move to the store if staff logins ever scale.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000;

// Staff sign-in: email + password, no OTP. The password is only ever compared
// against the scrypt hash in ADMIN_PASSWORD_HASH; the plaintext is never stored.
async function adminLogin(email, password) {
  const key = String(email).toLowerCase();
  const state = attempts.get(key);
  if (state && state.count >= MAX_ATTEMPTS && Date.now() - state.last < LOCKOUT_MS) {
    throw new ApiError(429, 'Too many failed attempts. Try again in a few minutes.');
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  // Same message either way: don't reveal which staff addresses exist.
  const bad = ApiError.unauthorized('Wrong email or password');
  if (!isAdmin(email) || !hash || !verifyPassword(password, hash)) {
    attempts.set(key, { count: (state?.count || 0) + 1, last: Date.now() });
    throw bad;
  }
  attempts.delete(key);

  let user = await userModel.findByEmail(key);
  if (!user) {
    const { name, initials } = deriveIdentity(key);
    user = await userModel.createVerified({ email: key, name, initials, branch: null });
  }
  return { token: signToken(user), user: await publicUser(user) };
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
    isAdmin: isAdmin(user.email),
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

module.exports = { sendOtp, verifyOtp, adminLogin, me, updatePreferences };
