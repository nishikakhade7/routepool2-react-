const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { driverModel } = require('../../models/driver.model');

// Driver tokens carry role 'driver' and point at the drivers table, never users,
// so a driver token is refused by every student route (middleware/auth.js finds
// no user) and a student token is refused here.
async function driverAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized('Missing bearer token'));
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
  if (payload.role !== 'driver') return next(ApiError.forbidden('Drivers only'));
  if (!(await driverModel.findById(payload.sub))) return next(ApiError.unauthorized('Session expired, please sign in again'));
  req.driver = { id: payload.sub, email: payload.email };
  next();
}

module.exports = (req, res, next) => driverAuth(req, res, next).catch(next);
