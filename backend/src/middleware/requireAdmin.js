const ApiError = require('../utils/ApiError');

// Admins are listed in ADMIN_EMAILS (comma-separated) in .env. No admin accounts
// table: the panel is staff-only and the roster changes about never.
// ponytail: env list, move to a role column when students can be promoted in-app.
const admins = () => String(process.env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function isAdmin(email) {
  return admins().includes(String(email || '').toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user?.email)) return next(ApiError.forbidden('Admins only'));
  next();
}

module.exports = requireAdmin;
module.exports.isAdmin = isAdmin;
