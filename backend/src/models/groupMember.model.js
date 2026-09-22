const mock = process.env.USE_MOCK_DB === 'true';
if (mock) {
  module.exports = require('../db/mockStore').groupMemberModel;
} else {
  const prisma = require('../config/prisma');

  /**
   * Upsert a group member — creates if (group_id, user_id) is new,
   * updates fare_share if they're already in the group.
   * Accepts an optional Prisma transaction client (`tx`).
   */
  async function add({ groupId, userId, rideRequestId, dropNodeId, fareShare }, tx) {
    const client = tx || prisma;
    return client.groupMember.upsert({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      update: { fare_share: fareShare },
      create: {
        group_id:        groupId,
        user_id:         userId,
        ride_request_id: rideRequestId,
        drop_node_id:    dropNodeId,
        fare_share:      fareShare,
        status:          'confirmed',
      },
    });
  }

  /**
   * Returns all members of a group with joined user, drop node, and ride
   * request data. Shape matches what groups.service and matching.service expect.
   */
  async function listByGroup(groupId) {
    const members = await prisma.groupMember.findMany({
      where:   { group_id: groupId },
      orderBy: { joined_at: 'asc' },
      include: {
        user:        { select: { name: true, initials: true, branch: true, email: true } },
        dropNode:    { select: { name: true, short_name: true } },
        rideRequest: { select: { solo_fare: true, estimated_distance_km: true } },
      },
    });

    return members.map((m) => ({
      ...m,
      name:                  m.user.name,
      initials:              m.user.initials,
      branch:                m.user.branch,
      email:                 m.user.email,
      drop_name:             m.dropNode.name,
      drop_short:            m.dropNode.short_name,
      solo_fare:             m.rideRequest.solo_fare,
      estimated_distance_km: m.rideRequest.estimated_distance_km,
    }));
  }

  async function isMember(groupId, userId) {
    const m = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    });
    return m !== null;
  }

  module.exports = { add, listByGroup, isMember };
}
