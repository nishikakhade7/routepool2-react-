const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: { message: 'Duplicate record' } });
  }

  console.error(err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(env.nodeEnv !== 'production' ? { stack: err.stack } : {}),
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
