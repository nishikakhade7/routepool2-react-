const { pool } = require('../config/db');

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createVerified({ email, name, initials, branch }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, initials, branch, is_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING *`,
    [email, name, initials, branch]
  );
  return rows[0];
}

async function markVerified(id) {
  const { rows } = await pool.query(
    'UPDATE users SET is_verified = true WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, createVerified, markVerified };
