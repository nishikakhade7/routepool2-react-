const ApiError = require('../utils/ApiError');
const env = require('../config/env');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ApiError (domain errors thrown by services)
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
  }

  // Prisma errors — detected by constructor name so we don't need an eager import
  // of @prisma/client/runtime/library (which requires the generated client to exist).
  const errName = err.constructor?.name ?? '';

  // PrismaClientKnownRequestError with code P2002 → unique constraint (was pg 23505)
  if (errName === 'PrismaClientKnownRequestError' && err.code === 'P2002') {
    return res.status(409).json({ error: { message: 'Duplicate record' } });
  }

  // PrismaClientKnownRequestError with code P2025 → record not found
  if (errName === 'PrismaClientKnownRequestError' && err.code === 'P2025') {
    return res.status(404).json({ error: { message: 'Record not found' } });
  }

  // PrismaClientValidationError → bad data shape
  if (errName === 'PrismaClientValidationError') {
    return res.status(400).json({ error: { message: 'Invalid data provided' } });
  }

  // Legacy raw pg unique violation (kept for mock store compatibility)
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
