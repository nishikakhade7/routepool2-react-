/**
 * Node model — PostGIS via $queryRaw
 * ====================================
 * The `nodes` table has a `geom` column of type geography(Point, 4326).
 * Prisma does not natively support PostGIS, so all queries that need
 * lat/lng extraction or proximity search use prisma.$queryRaw.
 *
 * Result rows are normalised to { id, name, shortName, area, lat, lng }
 * matching what the matching service and frontend expect.
 */

const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').nodeModel;
} else {
  const prisma = require('../config/prisma');

  async function listAll() {
    const rows = await prisma.$queryRaw`
      SELECT id::text,
             name,
             short_name AS "shortName",
             area::text,
             ST_Y(geom::geometry) AS lat,
             ST_X(geom::geometry) AS lng
      FROM nodes
      ORDER BY area, name
    `;
    return rows;
  }

  async function findById(id) {
    const rows = await prisma.$queryRaw`
      SELECT id::text,
             name,
             short_name AS "shortName",
             area::text,
             ST_Y(geom::geometry) AS lat,
             ST_X(geom::geometry) AS lng
      FROM nodes
      WHERE id = ${id}::uuid
    `;
    return rows[0] || null;
  }

  /**
   * Returns IDs of all nodes whose geography is within `radiusMeters` of
   * the node with `nodeId`. Uses PostGIS ST_DWithin on geography type
   * (operates in metres, no manual projection needed).
   */
  async function findNearbyIds(nodeId, radiusMeters = 600) {
    const rows = await prisma.$queryRaw`
      SELECT b.id::text AS id
      FROM nodes a
      JOIN nodes b ON ST_DWithin(a.geom, b.geom, ${radiusMeters})
      WHERE a.id = ${nodeId}::uuid
    `;
    const ids = rows.map((r) => r.id);
    return ids.length > 0 ? ids : [nodeId];
  }

  module.exports = { listAll, findById, findNearbyIds };
}
