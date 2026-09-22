const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').routeEdgeModel;
} else {
  const prisma = require('../config/prisma');

  async function listAll() {
    const edges = await prisma.routeEdge.findMany();
    // Normalise to the camelCase shape the dijkstra utility expects.
    return edges.map((e) => ({
      nodeAId: e.node_a_id,
      nodeBId: e.node_b_id,
      distanceKm: Number(e.distance_km),
    }));
  }

  module.exports = { listAll };
}
