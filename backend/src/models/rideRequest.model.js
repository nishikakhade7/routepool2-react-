const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').rideRequestModel;
} else {
  const { pool } = require('../config/db');

  async function create({ userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes, estimatedDistanceKm, soloFare }) {
    const { rows } = await pool.query(
      `INSERT INTO ride_requests
        (user_id, pickup_node_id, drop_node_id, window_start, window_end, flex_minutes, estimated_distance_km, solo_fare)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes, estimatedDistanceKm, soloFare]
    );
    return rows[0];
  }

  async function findById(id) {
    const { rows } = await pool.query('SELECT * FROM ride_requests WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async function findByIds(ids) {
    const { rows } = await pool.query('SELECT * FROM ride_requests WHERE id = ANY($1::uuid[])', [ids]);
    return rows;
  }

  async function findOpenCandidates({ pickupNodeIds, excludeUserId, excludeRequestId }) {
    const { rows } = await pool.query(
      `SELECT * FROM ride_requests
       WHERE pickup_node_id = ANY($1::uuid[]) AND status = 'open' AND user_id <> $2 AND id <> $3`,
      [pickupNodeIds, excludeUserId, excludeRequestId]
    );
    return rows;
  }

  async function markMatched(id, groupId, client = pool) {
    const { rows } = await client.query(
      "UPDATE ride_requests SET status = 'matched', group_id = $2 WHERE id = $1 RETURNING *",
      [id, groupId]
    );
    return rows[0];
  }

  async function busyRoutes(limit = 5) {
    const { rows } = await pool.query(
      `SELECT pn.name AS "pickupName", dn.name AS "dropName", dn.short_name AS "dropShort",
              COUNT(*)::int AS count
       FROM ride_requests r
       JOIN nodes pn ON pn.id = r.pickup_node_id
       JOIN nodes dn ON dn.id = r.drop_node_id
       WHERE r.status = 'open'
       GROUP BY pn.name, dn.name, dn.short_name
       ORDER BY count DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  module.exports = { create, findById, findByIds, findOpenCandidates, markMatched, busyRoutes };
}
