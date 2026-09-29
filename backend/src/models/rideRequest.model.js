const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').rideRequestModel;
} else {
  const prisma = require('../config/prisma');

  async function create({ userId, pickupNodeId, dropNodeId, windowStart, windowEnd, flexMinutes, estimatedDistanceKm, soloFare }) {
    return prisma.rideRequest.create({
      data: {
        user_id:               userId,
        pickup_node_id:        pickupNodeId,
        drop_node_id:          dropNodeId,
        window_start:          new Date(windowStart),
        window_end:            new Date(windowEnd),
        flex_minutes:          flexMinutes,
        estimated_distance_km: estimatedDistanceKm,
        solo_fare:             soloFare,
        status:                'open',
      },
    });
  }

  async function findById(id) {
    return prisma.rideRequest.findUnique({ where: { id } });
  }

  async function findByIds(ids) {
    return prisma.rideRequest.findMany({ where: { id: { in: ids } } });
  }

  async function findOpenCandidates({ pickupNodeIds, excludeUserId, excludeRequestId }) {
    return prisma.rideRequest.findMany({
      where: {
        pickup_node_id: { in: pickupNodeIds },
        // open requests, plus members of groups still forming (not yet full)
        OR:             [{ status: 'open' }, { status: 'matched', group: { status: 'forming' } }],
        user_id:        { not: excludeUserId },
        id:             { not: excludeRequestId },
      },
    });
  }

  async function listOpenUngrouped() {
    return prisma.rideRequest.findMany({ where: { status: 'open', group_id: null } });
  }

  async function findActiveByUser(userId) {
    return prisma.rideRequest.findMany({ where: { user_id: userId, status: { in: ['open', 'matched'] } } });
  }

  async function cancelOpenForUser(userId, tx) {
    const client = tx || prisma;
    return client.rideRequest.updateMany({ where: { user_id: userId, status: 'open' }, data: { status: 'cancelled' } });
  }

  /**
   * Update a ride request to 'matched' and assign it to a group.
   * Accepts an optional Prisma transaction client (`tx`) so it can participate
   * in the groups.service withTransaction block.
   */
  async function markMatched(id, groupId, tx) {
    const client = tx || prisma;
    return client.rideRequest.update({
      where: { id },
      data:  { status: 'matched', group_id: groupId },
    });
  }

  /**
   * Returns the busiest pickup→drop corridors among currently open requests.
   * Uses $queryRaw for the GROUP BY JOIN that Prisma can't express natively.
   */
  async function busyRoutes(limit = 5) {
    const rows = await prisma.$queryRaw`
      SELECT pn.name        AS "pickupName",
             pn.short_name  AS "pickupShort",
             dn.name        AS "dropName",
             dn.short_name  AS "dropShort",
             COUNT(*)::int  AS count
      FROM ride_requests r
      JOIN nodes pn ON pn.id = r.pickup_node_id
      JOIN nodes dn ON dn.id = r.drop_node_id
      LEFT JOIN groups g ON g.id = r.group_id
      WHERE r.status = 'open' OR (r.status = 'matched' AND g.status = 'forming')
      GROUP BY pn.name, pn.short_name, dn.name, dn.short_name
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows;
  }

  module.exports = { create, findById, findByIds, findOpenCandidates, listOpenUngrouped, findActiveByUser, cancelOpenForUser, markMatched, busyRoutes };
}
