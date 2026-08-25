const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

module.exports = { signToken };
