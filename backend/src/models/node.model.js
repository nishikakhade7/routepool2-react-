const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').nodeModel;
} else {
  const { pool } = require('../config/db');

  async function listAll() {
    const { rows } = await pool.query(
      `SELECT id, name, short_name AS "shortName", area,
              ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM nodes ORDER BY area, name`
    );
    return rows;
  }

  async function findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, short_name AS "shortName", area,
              ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM nodes WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async function findNearbyIds(nodeId, radiusMeters = 600) {
    const { rows } = await pool.query(
      `SELECT b.id FROM nodes a
       JOIN nodes b ON ST_DWithin(a.geom, b.geom, $2)
       WHERE a.id = $1`,
      [nodeId, radiusMeters]
    );
    return rows.map((r) => r.id);
  }

  module.exports = { listAll, findById, findNearbyIds };
}
