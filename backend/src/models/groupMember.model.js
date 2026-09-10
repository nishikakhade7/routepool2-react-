const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').groupMemberModel;
} else {
  const { pool } = require('../config/db');

  async function add({ groupId, userId, rideRequestId, dropNodeId, fareShare }, client = pool) {
    const { rows } = await client.query(
      `INSERT INTO group_members (group_id, user_id, ride_request_id, drop_node_id, fare_share, status)
       VALUES ($1, $2, $3, $4, $5, 'confirmed')
       ON CONFLICT (group_id, user_id) DO UPDATE SET fare_share = EXCLUDED.fare_share
       RETURNING *`,
      [groupId, userId, rideRequestId, dropNodeId, fareShare]
    );
    return rows[0];
  }

  async function listByGroup(groupId) {
    const { rows } = await pool.query(
      `SELECT gm.*, u.name, u.initials, u.branch, u.email,
              dn.name AS drop_name, dn.short_name AS drop_short,
              rr.solo_fare, rr.estimated_distance_km
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       JOIN nodes dn ON dn.id = gm.drop_node_id
       JOIN ride_requests rr ON rr.id = gm.ride_request_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at`,
      [groupId]
    );
    return rows;
  }

  async function isMember(groupId, userId) {
    const { rows } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    return rows.length > 0;
  }

  module.exports = { add, listByGroup, isMember };
}
