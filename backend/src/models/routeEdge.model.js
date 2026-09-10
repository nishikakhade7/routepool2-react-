const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').routeEdgeModel;
} else {
  const { pool } = require('../config/db');

  async function listAll() {
    const { rows } = await pool.query(
      `SELECT node_a_id AS "nodeAId", node_b_id AS "nodeBId", distance_km AS "distanceKm"
       FROM route_edges`
    );
    return rows;
  }

  module.exports = { listAll };
}
