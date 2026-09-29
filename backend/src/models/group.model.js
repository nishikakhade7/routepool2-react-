const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').groupModel;
} else {
  const prisma = require('../config/prisma');

  async function create({ pickupNodeId, departureTime, totalFare }, tx) {
    const client = tx || prisma;
    return client.group.create({
      data: {
        pickup_node_id: pickupNodeId,
        departure_time: new Date(departureTime),
        total_fare:     totalFare,
        status:         'forming',
      },
    });
  }

  async function findById(id) {
    return prisma.group.findUnique({ where: { id } });
  }

  async function listForming() {
    return prisma.group.findMany({ where: { status: 'forming' } });
  }

  async function setStatus(id, status, tx) {
    const client = tx || prisma;
    return client.group.update({ where: { id }, data: { status } });
  }

  async function updateTotalFare(id, totalFare, tx) {
    const client = tx || prisma;
    return client.group.update({
      where: { id },
      data:  { total_fare: totalFare },
    });
  }

  /**
   * Returns the group_id of any existing group whose members' ride_request_ids
   * exactly match `rideRequestIds` (sorted), or null if none exists.
   *
   * Uses $queryRaw for the array_agg / HAVING comparison — not expressible
   * in Prisma's query API.
   */
  async function findByExactRideRequestSet(rideRequestIds) {
    const sorted = [...rideRequestIds].sort();
    const rows = await prisma.$queryRaw`
      SELECT gm.group_id::text AS group_id
      FROM group_members gm
      GROUP BY gm.group_id
      HAVING array_agg(gm.ride_request_id ORDER BY gm.ride_request_id) = ${sorted}::uuid[]
    `;
    return rows[0]?.group_id || null;
  }

  // ponytail: no driver column in the Postgres schema yet - kept in process memory
  // (same "decided once per group" rule as the mock store); add a column to persist it.
  const drivers = new Map();
  async function setDriverIfAbsent(id, driver) {
    if (!drivers.has(id)) drivers.set(id, driver);
    return drivers.get(id);
  }

  module.exports = { create, findById, listForming, setStatus, updateTotalFare, findByExactRideRequestSet, setDriverIfAbsent };
}
