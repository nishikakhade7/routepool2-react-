const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').chatMessageModel;
} else {
  const { pool } = require('../config/db');

  async function create({ groupId, userId, message }) {
    const { rows } = await pool.query(
      'INSERT INTO chat_messages (group_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
      [groupId, userId, message]
    );
    return rows[0];
  }

  async function listByGroup(groupId, { limit = 100 } = {}) {
    const { rows } = await pool.query(
      `SELECT cm.id, cm.message, cm.created_at, u.id AS user_id, u.name, u.initials
       FROM chat_messages cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.group_id = $1
       ORDER BY cm.created_at ASC
       LIMIT $2`,
      [groupId, limit]
    );
    return rows;
  }

  module.exports = { create, listByGroup };
}
