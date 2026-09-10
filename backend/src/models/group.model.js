const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').groupModel;
} else {
  const { pool } = require('../config/db');

  async function create({ pickupNodeId, departureTime, totalFare }, client = pool) {
    const { rows } = await client.query(
      `INSERT INTO groups (pickup_node_id, departure_time, total_fare, status)
       VALUES ($1, $2, $3, 'forming') RETURNING *`,
      [pickupNodeId, departureTime, totalFare]
    );
    return rows[0];
  }

  async function findById(id) {
    const { rows } = await pool.query('SELECT * FROM groups WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async function updateTotalFare(id, totalFare, client = pool) {
    const { rows } = await client.query(
      'UPDATE groups SET total_fare = $2 WHERE id = $1 RETURNING *',
      [id, totalFare]
    );
    return rows[0];
  }

  async function findByExactRideRequestSet(rideRequestIds) {
    const sorted = [...rideRequestIds].sort();
    const { rows } = await pool.query(
      `SELECT gm.group_id
       FROM group_members gm
       GROUP BY gm.group_id
       HAVING array_agg(gm.ride_request_id ORDER BY gm.ride_request_id) = $1::uuid[]`,
      [sorted]
    );
    return rows[0]?.group_id || null;
  }

  module.exports = { create, findById, updateTotalFare, findByExactRideRequestSet };
}
