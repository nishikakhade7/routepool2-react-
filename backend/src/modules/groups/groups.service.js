const { withTransaction } = require('../../config/db');
const groupModel = require('../../models/group.model');
const groupMemberModel = require('../../models/groupMember.model');
const rideRequestModel = require('../../models/rideRequest.model');
const userModel = require('../../models/user.model');
const chatMessageModel = require('../../models/chatMessage.model');
const routeEdgeModel = require('../../models/routeEdge.model');
const { dijkstra } = require('../../utils/dijkstra');
const { buildCumulativePath, splitFareBySegments } = require('../../utils/fare');
const ApiError = require('../../utils/ApiError');
const env = require('../../config/env');

// Joins (or creates) the group made up of exactly `memberRideRequestIds`.
// The caller must own `rideRequestId`, one of the ids in that set - this is
// how both the first rider (creating the group) and later riders (joining
// a group a groupmate already locked in) go through the same endpoint.
async function join(userId, { rideRequestId, memberRideRequestIds }) {
  if (!memberRideRequestIds.includes(rideRequestId)) {
    throw ApiError.badRequest('rideRequestId must be included in memberRideRequestIds');
  }

  const requests = await rideRequestModel.findByIds(memberRideRequestIds);
  if (requests.length !== memberRideRequestIds.length) {
    throw ApiError.badRequest('One or more ride requests not found');
  }

  const own = requests.find((r) => r.id === rideRequestId);
  if (!own || own.user_id !== userId) throw ApiError.forbidden('You do not own this ride request');
  if (own.status === 'matched') throw ApiError.conflict('This ride request has already been matched');

  const samePickup = requests.every((r) => r.pickup_node_id === own.pickup_node_id);
  if (!samePickup) throw ApiError.badRequest('All members must share the same pickup node');

  const existingGroupId = await groupModel.findByExactRideRequestSet(memberRideRequestIds);
  if (!existingGroupId) {
    // No group with this exact composition exists yet, so we're about to create one.
    // Reject if any other member is already locked into a *different* group.
    const foreignMatch = requests.find((r) => r.id !== rideRequestId && r.status === 'matched');
    if (foreignMatch) throw ApiError.conflict('One of the selected riders has already joined a different group');
  }

  const edges = await routeEdgeModel.listAll();
  const { pathTo } = dijkstra(edges, own.pickup_node_id);

  const memberPaths = requests.map((r) => {
    const path = pathTo(r.drop_node_id);
    if (!path) throw ApiError.badRequest(`No known route for ride request ${r.id}`);
    path.stops = buildCumulativePath(edges, path.nodeIds);
    return { request: r, path };
  });

  const backbone = memberPaths.reduce((a, b) => (b.path.distanceKm > a.path.distanceKm ? b : a));

  // One shared auto can only serve a single linear route - reject a
  // composition where a member's drop isn't actually on the backbone route.
  for (const m of memberPaths) {
    const onBackbone = m.path.nodeIds.every((id, i) => id === backbone.path.nodeIds[i]);
    if (!onBackbone) {
      throw ApiError.badRequest(`Ride request ${m.request.id} is not on the same route as the rest of the group`);
    }
  }

  const fareMembers = memberPaths.map((m) => ({
    userId: m.request.user_id,
    dropCumulativeKm: m.path.distanceKm,
  }));
  const { totalFare, shares } = splitFareBySegments(backbone.path.stops, fareMembers, env.autoTariff);

  const groupId = await withTransaction(async (client) => {
    let gid = existingGroupId;
    if (!gid) {
      const departureTime = new Date(Math.max(...requests.map((r) => new Date(r.window_start).getTime())));
      const created = await groupModel.create({ pickupNodeId: own.pickup_node_id, departureTime, totalFare }, client);
      gid = created.id;
    } else {
      await groupModel.updateTotalFare(gid, totalFare, client);
    }

    for (const m of memberPaths) {
      await groupMemberModel.add({
        groupId: gid,
        userId: m.request.user_id,
        rideRequestId: m.request.id,
        dropNodeId: m.request.drop_node_id,
        fareShare: shares.get(m.request.user_id),
      }, client);
      await rideRequestModel.markMatched(m.request.id, gid, client);
    }

    return gid;
  });

  const group = await groupModel.findById(groupId);
  const members = await groupMemberModel.listByGroup(groupId);

  return {
    id: group.id,
    status: group.status,
    departureTime: group.departure_time,
    totalFare: Number(group.total_fare),
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.name,
      initials: m.initials,
      branch: m.branch,
      dropName: m.drop_name,
      dropShort: m.drop_short,
      dropDistanceKm: Number(m.estimated_distance_km),
      fareShare: Number(m.fare_share),
      soloFare: Number(m.solo_fare),
      isYou: m.user_id === userId,
    })),
  };
}

async function assertMembership(groupId, userId) {
  const isMember = await groupMemberModel.isMember(groupId, userId);
  if (!isMember) throw ApiError.forbidden('You are not a member of this group');
}

async function listChat(groupId, userId) {
  await assertMembership(groupId, userId);
  const messages = await chatMessageModel.listByGroup(groupId);
  return messages.map((m) => ({
    id: m.id,
    message: m.message,
    createdAt: m.created_at,
    userId: m.user_id,
    name: m.name,
    initials: m.initials,
    isYou: m.user_id === userId,
  }));
}

async function postChat(groupId, userId, message) {
  await assertMembership(groupId, userId);
  const saved = await chatMessageModel.create({ groupId, userId, message });
  const user = await userModel.findById(userId);
  return {
    id: saved.id,
    message: saved.message,
    createdAt: saved.created_at,
    userId,
    name: user.name,
    initials: user.initials,
    isYou: true,
  };
}

module.exports = { join, listChat, postChat };
