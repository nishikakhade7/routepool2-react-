const crypto = require('crypto');

function generateOtp() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function hashOtp(code, email) {
  return crypto.createHash('sha256').update(`${email}:${code}`).digest('hex');
}

module.exports = { generateOtp, hashOtp };
