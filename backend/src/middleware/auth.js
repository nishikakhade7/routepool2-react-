const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const userModel = require('../models/user.model');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing bearer token'));
  }
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
  // A valid token for a user that no longer exists (e.g. mock DB reset on restart).
  if (!(await userModel.findById(payload.sub))) return next(ApiError.unauthorized('Session expired, please sign in again'));
  req.user = { id: payload.sub, email: payload.email };
  next();
}

module.exports = (req, res, next) => authMiddleware(req, res, next).catch(next);
