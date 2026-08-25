const ApiError = require('../utils/ApiError');

// Wraps a zod schema shaped as { body, query, params } and validates the
// matching parts of the request, replacing them with the parsed (coerced) data.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    throw ApiError.badRequest('Validation failed', result.error.flatten());
  }
  if (result.data.body !== undefined) req.body = result.data.body;
  if (result.data.query !== undefined) req.query = result.data.query;
  if (result.data.params !== undefined) req.params = result.data.params;
  next();
};

module.exports = validate;
