const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').otpModel;
} else {
  const { pool } = require('../config/db');

  async function create({ email, codeHash, expiresAt }) {
    const { rows } = await pool.query(
      'INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3) RETURNING *',
      [email, codeHash, expiresAt]
    );
    return rows[0];
  }

  async function findLatestActive(email) {
    const { rows } = await pool.query(
      `SELECT * FROM otp_codes
       WHERE email = $1 AND consumed = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  async function consume(id) {
    await pool.query('UPDATE otp_codes SET consumed = true WHERE id = $1', [id]);
  }

  async function invalidateAllForEmail(email) {
    await pool.query(
      'UPDATE otp_codes SET consumed = true WHERE email = $1 AND consumed = false',
      [email]
    );
  }

  module.exports = { create, findLatestActive, consume, invalidateAllForEmail };
}
